import { db } from "./db";
import { Transaction } from "./models";
import { debitWallet, creditWallet } from "./ledger";

function makeReference(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .toUpperCase();
}

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

  const externalReference =
    reference || makeReference(service);

  const existing = await Transaction.findOne({
    externalReference,
  });

  if (existing) {
    return existing;
  }

  const tx = await Transaction.create({
    userId,
    service,
    status: "PENDING",
    externalReference,
    amountKobo,
    costKobo: 0,
    profitKobo: 0,
    metadata,
  });

  try {
    await debitWallet(
      userId,
      amountKobo,
      `SALE-${externalReference}`,
      {
        service,
        transaction: externalReference,
      }
    );
  } catch (error) {
    tx.status = "FAILED";
    tx.metadata = {
      ...metadata,
      walletError:
        error instanceof Error
          ? error.message
          : String(error),
    };

    await tx.save();

    throw error;
  }

  return tx;
}

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

  const tx: any = await Transaction.findOne({
    externalReference: reference,
  });

  if (!tx) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  if (tx.status === "SUCCESS") {
    return tx;
  }

  const amountKobo = Number(tx.amountKobo || 0);
  const actualCostKobo = Math.max(
    0,
    Number(costKobo || 0)
  );

  const profitKobo = Math.max(
    0,
    amountKobo - actualCostKobo
  );

  tx.status = "SUCCESS";
  tx.costKobo = actualCostKobo;
  tx.profitKobo = profitKobo;
  tx.providerTransactionId =
    providerTransactionId || tx.providerTransactionId;

  tx.metadata = {
    ...(tx.metadata || {}),
    ...metadata,
  };

  await tx.save();

  return tx;
}

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

  const tx: any = await Transaction.findOne({
    externalReference: reference,
  });

  if (!tx) {
    throw new Error("TRANSACTION_NOT_FOUND");
  }

  if (tx.status === "FAILED") {
    return tx;
  }

  if (tx.status === "SUCCESS") {
    return tx;
  }

  await creditWallet(
    String(tx.userId),
    Number(tx.amountKobo),
    `REFUND-${reference}`,
    {
      reason,
      transaction: reference,
    }
  );

  tx.status = "FAILED";

  tx.metadata = {
    ...(tx.metadata || {}),
    ...metadata,
    failureReason: reason,
  };

  await tx.save();

  return tx;
}