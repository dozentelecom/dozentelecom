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
   * Reference is the idempotency key.
   */
  const existing =
    await Transaction.findOne({
      externalReference,
    });

  if (existing) {
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
   * Create transaction BEFORE touching wallet.
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
     * Wallet was successfully debited.
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
     * Debit failed.
     *
     * No refund because no successful debit
     * was recorded.
     */
    tx.status = "FAILED";

    tx.metadata = {
      ...(tx.metadata || {}),
      walletDebited: false,
      walletRefunded: false,
      walletError:
        error instanceof Error
          ? error.message
          : String(error),
      failureReason:
        error instanceof Error
          ? error.message
          : String(error),
      failedAt:
        new Date().toISOString(),
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
   * Final transactions cannot move backwards.
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
   * Already successful.
   */
  if (tx.status === "SUCCESS") {
    return tx;
  }

  /*
   * Never turn a failed/reversed transaction
   * back into SUCCESS.
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

  if (providerTransactionId) {
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
   REFUND ONE FAILED TRANSACTION
   ========================================================= */

export async function refundFailedServiceTransaction(
  tx: any,
  reason?: string
) {
  /*
   * Only transactions that actually debited
   * the customer's wallet should be refunded.
   */
  const walletDebited =
    Boolean(
      tx.metadata?.walletDebited
    );

  if (!walletDebited) {
    /*
     * Nothing was taken from wallet.
     */
    tx.metadata = {
      ...(tx.metadata || {}),
      walletRefunded: false,
      refundSkipped: true,
      refundSkipReason:
        "Wallet was not debited",
    };

    await tx.save();

    return tx;
  }

  /*
   * Already refunded.
   */
  if (
    Boolean(
      tx.metadata?.walletRefunded
    )
  ) {
    return tx;
  }

  const amountKobo =
    Number(tx.amountKobo || 0);

  if (!validKobo(amountKobo)) {
    throw new Error(
      "INVALID_REFUND_AMOUNT"
    );
  }

  /*
   * Deterministic refund reference.
   *
   * Running this function multiple times
   * cannot create multiple refunds.
   */
  const refundReference =
    `REFUND-${tx.externalReference}`;

  try {
    await creditWallet(
      String(tx.userId),
      amountKobo,
      refundReference,
      {
        reason:
          reason ||
          tx.metadata?.failureReason ||
          "Service transaction failed",
        transaction:
          tx.externalReference,
        type:
          "SERVICE_REVERSAL",
      }
    );

    /*
     * Refund succeeded.
     */
    tx.metadata = {
      ...(tx.metadata || {}),
      walletRefunded: true,
      walletRefundedAt:
        new Date().toISOString(),
      refundReference,
    };

    await tx.save();

    return tx;
  } catch (error: any) {
    /*
     * If the ledger says the reference already
     * exists, the refund already happened.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      tx.metadata = {
        ...(tx.metadata || {}),
        walletRefunded: true,
        walletRefundedAt:
          tx.metadata?.walletRefundedAt ||
          new Date().toISOString(),
        refundReference,
      };

      await tx.save();

      return tx;
    }

    /*
     * DO NOT mark walletRefunded=true when
     * creditWallet actually failed.
     *
     * This allows the refund to be retried.
     */
    throw error;
  }
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
   * IMPORTANT:
   *
   * Do NOT immediately return just because
   * status === FAILED.
   *
   * An old FAILED transaction may have:
   *
   * walletDebited: true
   * walletRefunded: false
   *
   * In that situation we MUST refund it.
   */

  const walletDebited =
    Boolean(
      tx.metadata?.walletDebited
    );

  const walletRefunded =
    Boolean(
      tx.metadata?.walletRefunded
    );

  /*
   * SUCCESS transactions must never be
   * refunded by this function.
   */
  if (tx.status === "SUCCESS") {
    return tx;
  }

  /*
   * REVERSED transactions are already final.
   *
   * However, if somehow a reversed transaction
   * has a debit without a refund, recover it.
   */
  if (
    tx.status === "REVERSED" &&
    (!walletDebited ||
      walletRefunded)
  ) {
    return tx;
  }

  /*
   * If wallet was debited and has not yet been
   * refunded, perform the refund NOW.
   *
   * This also repairs old FAILED transactions.
   */
  if (
    walletDebited &&
    !walletRefunded
  ) {
    await refundFailedServiceTransaction(
      tx,
      reason
    );
  }

  /*
   * Mark transaction FAILED only after
   * successful refund.
   *
   * If refundFailedServiceTransaction()
   * throws, the transaction remains in its
   * previous state and can be retried safely.
   */
  tx.status = "FAILED";

  tx.metadata = {
    ...(tx.metadata || {}),
    ...(metadata || {}),
    failureReason: reason,
    failedAt:
      tx.metadata?.failedAt ||
      new Date().toISOString(),
  };

  await tx.save();

  return tx;
}

/* =========================================================
   RECOVER OLD FAILED TRANSACTIONS FOR ONE USER
   =========================================================
   This repairs transactions created before the
   refund bug was fixed.

   It finds:
     FAILED
     walletDebited = true
     walletRefunded != true

   and refunds them.
   ========================================================= */

export async function recoverFailedServiceTransactions(
  userId: string
) {
  await db();

  const failedTransactions: any[] =
    await Transaction.find({
      userId,
      status: "FAILED",
      "metadata.walletDebited": true,
      $or: [
        {
          "metadata.walletRefunded":
            {
              $exists: false,
            },
        },
        {
          "metadata.walletRefunded":
            false,
        },
      ],
    }).sort({
      createdAt: 1,
    });

  const recovered: any[] = [];
  const failed: any[] = [];

  for (
    const tx of failedTransactions
  ) {
    try {
      /*
       * Calling failServiceTransaction()
       * is safe because the function is now
       * idempotent.
       */
      const repaired =
        await failServiceTransaction({
          reference:
            String(
              tx.externalReference
            ),
          reason:
            tx.metadata
              ?.failureReason ||
            "Automatic recovery of failed service transaction",
          metadata: {
            automaticRefundRecovery:
              true,
            recoveredAt:
              new Date().toISOString(),
          },
        });

      recovered.push(
        repaired
      );
    } catch (error: any) {
      /*
       * Keep going so one bad transaction
       * does not prevent other refunds.
       */
      failed.push({
        reference:
          tx.externalReference,
        error:
          error?.message ||
          String(error),
      });
    }
  }

  return {
    found:
      failedTransactions.length,
    recovered:
      recovered.length,
    failed:
      failed.length,
    transactions:
      recovered,
    errors:
      failed,
  };
}

/* =========================================================
   RECOVER ALL FAILED TRANSACTIONS
   =========================================================
   Admin/system recovery helper.

   This can be used once to repair ALL customers
   affected by the old refund bug.
   ========================================================= */

export async function recoverAllFailedServiceTransactions() {
  await db();

  const failedTransactions: any[] =
    await Transaction.find({
      status: "FAILED",
      "metadata.walletDebited": true,
      $or: [
        {
          "metadata.walletRefunded":
            {
              $exists: false,
            },
        },
        {
          "metadata.walletRefunded":
            false,
        },
      ],
    }).sort({
      createdAt: 1,
    });

  const recovered: any[] = [];
  const failed: any[] = [];

  for (
    const tx of failedTransactions
  ) {
    try {
      const repaired =
        await failServiceTransaction({
          reference:
            String(
              tx.externalReference
            ),
          reason:
            tx.metadata
              ?.failureReason ||
            "Automatic recovery of old failed service transaction",
          metadata: {
            automaticRefundRecovery:
              true,
            recoveredAt:
              new Date().toISOString(),
          },
        });

      recovered.push(
        repaired
      );
    } catch (error: any) {
      failed.push({
        reference:
          tx.externalReference,
        userId:
          String(tx.userId),
        error:
          error?.message ||
          String(error),
      });
    }
  }

  return {
    found:
      failedTransactions.length,
    recovered:
      recovered.length,
    failed:
      failed.length,
    transactions:
      recovered,
    errors:
      failed,
  };
}