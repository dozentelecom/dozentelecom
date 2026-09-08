import { db } from "./db";
import { Transaction } from "./models";
import { debitWallet, creditWallet } from "./ledger";

function makeReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .toUpperCase();
}

function validKobo(value: number) {
  return (
    Number.isInteger(value) &&
    value > 0
  );
}

/* =========================================================
   START TRANSACTION
   ========================================================= */

export async function startServiceTransaction({
  userId,
  service,
  amountKobo,
  reference,
  metadata = {},
}: {
  userId: string;
  service: string;
  amountKobo: number;
  reference?: string;
  metadata?: any;
}) {
  await db();

  if (!validKobo(amountKobo)) {
    throw new Error("INVALID_AMOUNT");
  }

  const externalReference =
    reference ||
    makeReference(service);

  /*
   * IMPORTANT:
   *
   * A reference is the idempotency key.
   *
   * If the same purchase request reaches the
   * server twice, we return the existing
   * transaction instead of charging twice.
   */
  const existing =
    await Transaction.findOne({
      externalReference,
    });

  if (existing) {
    /*
     * Make sure the transaction belongs
     * to the same customer.
     */
    if (
      String(existing.userId) !==
      String(userId)
    ) {
      throw new Error(
        "TRANSACTION_REFERENCE_CONFLICT"
      );
    }

    return existing;
  }

  /*
   * Create the transaction BEFORE touching
   * the wallet.
   */
  const tx =
    await Transaction.create({
      userId,
      service,
      status: "PENDING",
      externalReference,
      amountKobo,
      costKobo: 0,
      profitKobo: 0,
      metadata: {
        ...(metadata || {}),
        walletDebited: false,
        walletRefunded: false,
        createdByServiceTransaction:
          true,
      },
    });

  try {
    /*
     * Atomic wallet debit.
     */
    await debitWallet(
      userId,
      amountKobo,
      `SALE-${externalReference}`,
      {
        service,
        transaction:
          externalReference,
      }
    );

    /*
     * Record that the wallet was actually
     * debited.
     */
    tx.metadata = {
      ...(tx.metadata || {}),
      walletDebited: true,
      walletDebitedAt:
        new Date().toISOString(),
    };

    await tx.save();

    return tx;
  } catch (error) {
    /*
     * The debit did not succeed.
     *
     * DO NOT refund here because there was
     * no successful wallet debit.
     */
    tx.status = "FAILED";

    tx.metadata = {
      ...(tx.metadata || {}),
      walletDebited: false,
      walletError:
        error instanceof Error
          ? error.message
          : String(error),
    };

    await tx.save();

    throw error;
  }
}

/* =========================================================
   MARK PROCESSING
   ========================================================= */

export async function processServiceTransaction({
  reference,
  metadata = {},
}: {
  reference: string;
  metadata?: any;
}) {
  await db();

  const tx: any =
    await Transaction.findOne({
      externalReference: reference,
    });

  if (!tx) {
    throw new Error(
      "TRANSACTION_NOT_FOUND"
    );
  }

  /*
   * Final transactions must never be moved
   * backwards.
   */
  if (
    tx.status === "SUCCESS" ||
    tx.status === "FAILED" ||
    tx.status === "REVERSED"
  ) {
    return tx;
  }

  tx.status = "PROCESSING";

  tx.metadata = {
    ...(tx.metadata || {}),
    ...(metadata || {}),
    processingStartedAt:
      tx.metadata?.processingStartedAt ||
      new Date().toISOString(),
  };

  await tx.save();

  return tx;
}

/* =========================================================
   COMPLETE TRANSACTION
   ========================================================= */

export async function completeServiceTransaction({
  reference,
  costKobo,
  providerTransactionId,
  metadata = {},
}: {
  reference: string;
  costKobo: number;
  providerTransactionId?: string;
  metadata?: any;
}) {
  await db();

  const tx: any =
    await Transaction.findOne({
      externalReference: reference,
    });

  if (!tx) {
    throw new Error(
      "TRANSACTION_NOT_FOUND"
    );
  }

  /*
   * Idempotent SUCCESS.
   *
   * Calling complete twice will NOT create
   * another wallet movement.
   */
  if (tx.status === "SUCCESS") {
    return tx;
  }

  /*
   * Never turn a refunded transaction back
   * into SUCCESS.
   */
  if (
    tx.status === "FAILED" ||
    tx.status === "REVERSED"
  ) {
    return tx;
  }

  const amountKobo =
    Number(tx.amountKobo || 0);

  if (!validKobo(amountKobo)) {
    throw new Error(
      "INVALID_TRANSACTION_AMOUNT"
    );
  }

  const actualCostKobo = Math.max(
    0,
    Number(costKobo || 0)
  );

  /*
   * Customer price:
   *
   * amountKobo
   *
   * Provider cost:
   *
   * costKobo
   *
   * Business profit:
   *
   * amountKobo - costKobo
   */
  const profitKobo = Math.max(
    0,
    amountKobo -
      actualCostKobo
  );

  tx.status = "SUCCESS";

  tx.costKobo =
    actualCostKobo;

  tx.profitKobo =
    profitKobo;

  if (
    providerTransactionId
  ) {
    tx.providerTransactionId =
      providerTransactionId;
  }

  tx.metadata = {
    ...(tx.metadata || {}),
    ...(metadata || {}),
    completedAt:
      new Date().toISOString(),
  };

  await tx.save();

  return tx;
}

/* =========================================================
   FAIL + REFUND TRANSACTION
   ========================================================= */

export async function failServiceTransaction({
  reference,
  reason,
  metadata = {},
}: {
  reference: string;
  reason: string;
  metadata?: any;
}) {
  await db();

  const tx: any =
    await Transaction.findOne({
      externalReference: reference,
    });

  if (!tx) {
    throw new Error(
      "TRANSACTION_NOT_FOUND"
    );
  }

  /*
   * Already failed.
   *
   * Do NOT refund again.
   */
  if (tx.status === "FAILED") {
    return tx;
  }

  /*
   * Successful transactions must never
   * be refunded by this function.
   */
  if (tx.status === "SUCCESS") {
    return tx;
  }

  /*
   * Already reversed.
   */
  if (tx.status === "REVERSED") {
    return tx;
  }

  const walletDebited =
    Boolean(
      tx.metadata?.walletDebited
    );

  /*
   * If the wallet was never debited,
   * there is nothing to refund.
   */
  if (walletDebited) {
    /*
     * CRITICAL IDEMPOTENCY PROTECTION
     *
     * The refund reference is deterministic.
     *
     * If this function runs twice, the second
     * credit will hit the duplicate reference
     * protection instead of giving the customer
     * two refunds.
     */
    const refundReference =
      `REFUND-${reference}`;

    const alreadyRefunded =
      Boolean(
        tx.metadata?.walletRefunded
      );

    if (!alreadyRefunded) {
      try {
        await creditWallet(
          String(tx.userId),
          Number(
            tx.amountKobo
          ),
          refundReference,
          {
            reason,
            transaction:
              reference,
            type:
              "SERVICE_REVERSAL",
          }
        );

        tx.metadata = {
          ...(tx.metadata || {}),
          walletRefunded: true,
          walletRefundedAt:
            new Date().toISOString(),
        };

        await tx.save();
      } catch (error: any) {
        /*
         * Duplicate ledger/reference means the
         * refund already happened.
         *
         * Mark it as refunded instead of paying
         * the customer twice.
         */
        if (
          /duplicate|E11000|unique/i.test(
            error?.message ||
              ""
          )
        ) {
          tx.metadata = {
            ...(tx.metadata || {}),
            walletRefunded: true,
            walletRefundedAt:
              new Date().toISOString(),
          };

          await tx.save();
        } else {
          /*
           * IMPORTANT:
           *
           * Do not mark the transaction FAILED
           * until the wallet refund succeeds.
           *
           * This allows a retry to complete the
           * refund safely.
           */
          throw error;
        }
      }
    }
  }

  tx.status = "FAILED";

  tx.metadata = {
    ...(tx.metadata || {}),
    ...(metadata || {}),
    failureReason: reason,
    failedAt:
      new Date().toISOString(),
  };

  await tx.save();

  return tx;
}