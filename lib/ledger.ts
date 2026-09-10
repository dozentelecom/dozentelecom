import { db } from "./db";
import {
  Ledger,
  Wallet,
} from "./models";

/* =========================================================
   GET / CREATE WALLET
   ========================================================= */

export async function wallet(
  userId: string
) {
  await db();

  /*
   * userId is UNIQUE in WalletSchema.
   *
   * Therefore there should only ever be one wallet
   * for a user.
   */
  const existing =
    await Wallet.findOne({
      userId,
    });

  if (existing) {
    return existing;
  }

  try {
    return await Wallet.create({
      userId,
      balanceKobo: 0,
      currency: "NGN",
    });
  } catch (
    error: any
  ) {
    /*
     * Another request may have created the wallet
     * simultaneously.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const created =
        await Wallet.findOne({
          userId,
        });

      if (created) {
        return created;
      }
    }

    throw error;
  }
}

/* =========================================================
   CREDIT WALLET
   ========================================================= */

export async function creditWallet(
  userId: string,
  kobo: number,
  ref: string,
  metadata: any = {}
) {
  await db();

  /* =======================================================
     VALIDATION
     ======================================================= */

  if (
    !Number.isInteger(kobo) ||
    kobo <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  const reference =
    String(ref || "").trim();

  if (!reference) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /* =======================================================
     IDEMPOTENCY CHECK
     ======================================================= */

  const existing =
    await Ledger.findOne({
      reference,
    });

  if (existing) {
    /*
     * Same reference must belong to the same user.
     */
    if (
      String(existing.userId) !==
      String(userId)
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    /*
     * Same reference must represent the
     * same credit.
     */
    if (
      existing.type !==
        "CREDIT" ||
      Number(
        existing.amountKobo
      ) !== kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    return await wallet(
      userId
    );
  }

  /* =======================================================
     GET WALLET
     ======================================================= */

  const w =
    await wallet(userId);

  /* =======================================================
     ATOMIC CREDIT
     ======================================================= */

  const updatedWallet =
    await Wallet.findOneAndUpdate(
      {
        _id: w._id,
      },
      {
        $inc: {
          balanceKobo:
            kobo,
        },
      },
      {
        new: true,
      }
    );

  if (!updatedWallet) {
    throw new Error(
      "WALLET_NOT_FOUND"
    );
  }

  /* =======================================================
     CREATE LEDGER
     ======================================================= */

  try {
    await Ledger.create({
      userId,

      type:
        "CREDIT",

      amountKobo:
        kobo,

      balanceAfterKobo:
        Number(
          updatedWallet.balanceKobo
        ),

      reference,

      status:
        "POSTED",

      metadata,
    });
  } catch (
    error: any
  ) {
    /*
     * Another concurrent request may have inserted
     * the same reference.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const duplicate =
        await Ledger.findOne({
          reference,
        });

      if (
        duplicate &&
        String(
          duplicate.userId
        ) ===
          String(userId) &&
        duplicate.type ===
          "CREDIT" &&
        Number(
          duplicate.amountKobo
        ) === kobo
      ) {
        /*
         * This request performed the temporary
         * wallet increment, but the other request
         * owns the ledger entry.
         *
         * Undo this request's increment.
         */
        await Wallet.findOneAndUpdate(
          {
            _id: w._id,
            balanceKobo: {
              $gte: kobo,
            },
          },
          {
            $inc: {
              balanceKobo:
                -kobo,
            },
          }
        );

        return await wallet(
          userId
        );
      }
    }

    /*
     * Ledger creation failed.
     *
     * Restore the wallet credit.
     */
    await Wallet.findOneAndUpdate(
      {
        _id: w._id,
        balanceKobo: {
          $gte: kobo,
        },
      },
      {
        $inc: {
          balanceKobo:
            -kobo,
        },
      }
    );

    throw error;
  }

  return updatedWallet;
}

/* =========================================================
   DEBIT WALLET
   ========================================================= */

export async function debitWallet(
  userId: string,
  kobo: number,
  ref: string,
  metadata: any = {}
) {
  await db();

  /* =======================================================
     VALIDATION
     ======================================================= */

  if (
    !Number.isInteger(kobo) ||
    kobo <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  const reference =
    String(ref || "").trim();

  if (!reference) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /* =======================================================
     IDEMPOTENCY CHECK
     ======================================================= */

  const existing =
    await Ledger.findOne({
      reference,
    });

  if (existing) {
    if (
      String(existing.userId) !==
      String(userId)
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    if (
      existing.type !==
        "DEBIT" ||
      Number(
        existing.amountKobo
      ) !== kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    return await wallet(
      userId
    );
  }

  /* =======================================================
     GET WALLET
     ======================================================= */

  const w =
    await wallet(userId);

  const currentBalance =
    Number(
      w.balanceKobo || 0
    );

  console.log(
    "================ WITHDRAWAL BALANCE CHECK ================"
  );

  console.log({
    userId:
      String(userId),

    walletId:
      String(w._id),

    walletBalanceKobo:
      currentBalance,

    walletBalanceNaira:
      currentBalance / 100,

    requestedKobo:
      kobo,

    requestedNaira:
      kobo / 100,
  });

  console.log(
    "==========================================================="
  );

  /* =======================================================
     ATOMIC BALANCE CHECK + DEBIT
     ======================================================= */

  const updatedWallet =
    await Wallet.findOneAndUpdate(
      {
        _id: w._id,

        /*
         * This is the actual protection against
         * overdrawing the wallet.
         */
        balanceKobo: {
          $gte: kobo,
        },
      },
      {
        $inc: {
          balanceKobo:
            -kobo,
        },
      },
      {
        new: true,
      }
    );

  /* =======================================================
     DEBIT FAILED
     ======================================================= */

  if (!updatedWallet) {
    const currentWallet =
      (await Wallet.findById(
        w._id
      ).lean()) as {
        balanceKobo?: number;
      } | null;

    const actualBalance =
      Number(
        currentWallet?.balanceKobo ??
          0
      );

    console.log(
      "================ WITHDRAWAL FAILED ================"
    );

    console.log({
      walletId:
        String(w._id),

      currentBalanceKobo:
        actualBalance,

      currentBalanceNaira:
        actualBalance / 100,

      requestedKobo:
        kobo,

      requestedNaira:
        kobo / 100,
    });

    console.log(
      "===================================================="
    );

    if (
      actualBalance < kobo
    ) {
      throw new Error(
        `Insufficient wallet balance. Your available balance is ₦${(
          actualBalance / 100
        ).toLocaleString(
          "en-NG",
          {
            minimumFractionDigits:
              2,

            maximumFractionDigits:
              2,
          }
        )}.`
      );
    }

    throw new Error(
      "WALLET_DEBIT_FAILED"
    );
  }

  /* =======================================================
     CREATE DEBIT LEDGER
     ======================================================= */

  try {
    await Ledger.create({
      userId,

      type:
        "DEBIT",

      amountKobo:
        kobo,

      balanceAfterKobo:
        Number(
          updatedWallet.balanceKobo
        ),

      reference,

      status:
        "POSTED",

      metadata,
    });
  } catch (
    error: any
  ) {
    /*
     * Concurrent request created the same ledger
     * reference.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const duplicate =
        await Ledger.findOne({
          reference,
        });

      if (
        duplicate &&
        String(
          duplicate.userId
        ) ===
          String(userId) &&
        duplicate.type ===
          "DEBIT" &&
        Number(
          duplicate.amountKobo
        ) === kobo
      ) {
        /*
         * This request performed the temporary
         * debit but does not own the ledger.
         *
         * Restore it.
         */
        await Wallet.findOneAndUpdate(
          {
            _id: w._id,
          },
          {
            $inc: {
              balanceKobo:
                kobo,
            },
          }
        );

        return await wallet(
          userId
        );
      }
    }

    /*
     * Ledger creation failed.
     *
     * Restore the debit.
     */
    await Wallet.findOneAndUpdate(
      {
        _id: w._id,
      },
      {
        $inc: {
          balanceKobo:
            kobo,
        },
      }
    );

    throw error;
  }

  console.log(
    "=== WALLET DEBIT SUCCESS ==="
  );

  console.log({
    userId:
      String(userId),

    reference,

    debitedKobo:
      kobo,

    debitedNaira:
      kobo / 100,

    remainingKobo:
      Number(
        updatedWallet.balanceKobo
      ),

    remainingNaira:
      Number(
        updatedWallet.balanceKobo
      ) / 100,
  });

  return updatedWallet;
}