
import mongoose from "mongoose";
import { db } from "./db";
import { Ledger, Wallet } from "./models";

/* =========================================================
   GET / CREATE WALLET
   ========================================================= */

export async function wallet(userId: string) {
  await db();

  const existing = await Wallet.findOne({ userId });

  if (existing) return existing;

  try {
    return await Wallet.create({
      userId,
      balanceKobo: 0,
      currency: "NGN",
    });
  } catch (error: any) {
    if (/duplicate|E11000|unique/i.test(error?.message || "")) {
      const created = await Wallet.findOne({ userId });
      if (created) return created;
    }

    throw error;
  }
}

/* =========================================================
   LEDGER REFERENCE VALIDATION
   ========================================================= */

async function findMatchingLedger(
  userId: string,
  kobo: number,
  reference: string,
  type: "CREDIT" | "DEBIT",
  session?: mongoose.ClientSession
) {
  let query = Ledger.findOne({ reference });

  if (session) query = query.session(session);

  const existing: any = await query;

  if (!existing) return null;

  if (
    String(existing.userId) !== String(userId) ||
    existing.type !== type ||
    Number(existing.amountKobo) !== kobo
  ) {
    throw new Error("LEDGER_REFERENCE_CONFLICT");
  }

  return existing;
}

/* =========================================================
   CREDIT WALLET INSIDE AN EXISTING TRANSACTION

   The caller must start and commit/abort the session.
   ========================================================= */

export async function creditWalletInSession(
  userId: string,
  kobo: number,
  ref: string,
  session: mongoose.ClientSession,
  metadata: any = {}
) {
  if (!session?.inTransaction()) {
    throw new Error("ACTIVE_TRANSACTION_REQUIRED");
  }

  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const reference = String(ref || "").trim();

  if (!reference) {
    throw new Error("INVALID_LEDGER_REFERENCE");
  }

  const existing = await findMatchingLedger(
    userId,
    kobo,
    reference,
    "CREDIT",
    session
  );

  if (existing) {
    const existingWallet = await Wallet.findOne({ userId }).session(session);

    if (!existingWallet) {
      throw new Error("WALLET_NOT_FOUND");
    }

    return existingWallet;
  }

  // Create the wallet if necessary and credit it atomically.
  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        currency: "NGN",
      },
      $inc: {
        balanceKobo: kobo,
      },
    },
    {
      upsert: true,
      new: true,
      session,
      setDefaultsOnInsert: false,
    }
  );

  if (!updatedWallet) {
    throw new Error("WALLET_NOT_FOUND");
  }

  await Ledger.create(
    [
      {
        userId,
        type: "CREDIT",
        amountKobo: kobo,
        balanceAfterKobo: Number(updatedWallet.balanceKobo),
        reference,
        status: "POSTED",
        metadata,
      },
    ],
    { session }
  );

  return updatedWallet;
}

/* =========================================================
   CREDIT WALLET

   Wallet increment and ledger creation commit together.
   ========================================================= */

export async function creditWallet(
  userId: string,
  kobo: number,
  ref: string,
  metadata: any = {}
) {
  await db();

  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const reference = String(ref || "").trim();

  if (!reference) {
    throw new Error("INVALID_LEDGER_REFERENCE");
  }

  const session = await mongoose.startSession();

  try {
    let result: any;

    await session.withTransaction(async () => {
      result = await creditWalletInSession(
        userId,
        kobo,
        reference,
        session,
        metadata
      );
    });

    if (!result) {
      throw new Error("WALLET_CREDIT_FAILED");
    }

    return result;
  } catch (error: any) {
    // A concurrent request may have completed this same credit.
    if (/duplicate|E11000|unique/i.test(error?.message || "")) {
      const existing = await findMatchingLedger(
        userId,
        kobo,
        reference,
        "CREDIT"
      );

      if (existing) {
        return await wallet(userId);
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }
}

/* =========================================================
   DEBIT WALLET INSIDE AN EXISTING TRANSACTION
   ========================================================= */

export async function debitWalletInSession(
  userId: string,
  kobo: number,
  ref: string,
  session: mongoose.ClientSession,
  metadata: any = {}
) {
  if (!session?.inTransaction()) {
    throw new Error("ACTIVE_TRANSACTION_REQUIRED");
  }

  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const reference = String(ref || "").trim();

  if (!reference) {
    throw new Error("INVALID_LEDGER_REFERENCE");
  }

  const existing = await findMatchingLedger(
    userId,
    kobo,
    reference,
    "DEBIT",
    session
  );

  if (existing) {
    const existingWallet = await Wallet.findOne({ userId }).session(session);

    if (!existingWallet) {
      throw new Error("WALLET_NOT_FOUND");
    }

    return existingWallet;
  }

  // Ensure a wallet exists. This does not change an existing balance.
  await Wallet.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        currency: "NGN",
        balanceKobo: 0,
      },
    },
    {
      upsert: true,
      new: true,
      session,
      setDefaultsOnInsert: false,
    }
  );

  // Debit only when the available balance is sufficient.
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId,
      balanceKobo: { $gte: kobo },
    },
    {
      $inc: {
        balanceKobo: -kobo,
      },
    },
    {
      new: true,
      session,
    }
  );

  if (!updatedWallet) {
    throw new Error("INSUFFICIENT_WALLET_BALANCE");
  }

  await Ledger.create(
    [
      {
        userId,
        type: "DEBIT",
        amountKobo: kobo,
        balanceAfterKobo: Number(updatedWallet.balanceKobo),
        reference,
        status: "POSTED",
        metadata,
      },
    ],
    { session }
  );

  return updatedWallet;
}

/* =========================================================
   DEBIT WALLET

   Wallet debit and ledger creation commit together.
   ========================================================= */

export async function debitWallet(
  userId: string,
  kobo: number,
  ref: string,
  metadata: any = {}
) {
  await db();

  if (!Number.isSafeInteger(kobo) || kobo <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const reference = String(ref || "").trim();

  if (!reference) {
    throw new Error("INVALID_LEDGER_REFERENCE");
  }

  const session = await mongoose.startSession();

  try {
    let result: any;

    await session.withTransaction(async () => {
      result = await debitWalletInSession(
        userId,
        kobo,
        reference,
        session,
        metadata
      );
    });

    if (!result) {
      throw new Error("WALLET_DEBIT_FAILED");
    }

    return result;
  } catch (error: any) {
    if (/duplicate|E11000|unique/i.test(error?.message || "")) {
      const existing = await findMatchingLedger(
        userId,
        kobo,
        reference,
        "DEBIT"
      );

      if (existing) {
        return await wallet(userId);
      }
    }

    if (error?.message === "INSUFFICIENT_WALLET_BALANCE") {
      const currentWallet: any = await Wallet.findOne({ userId }).lean();
      const actualBalance = Number(currentWallet?.balanceKobo || 0);

      throw new Error(
        `Insufficient wallet balance. Your available balance is ₦${(
          actualBalance / 100
        ).toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
