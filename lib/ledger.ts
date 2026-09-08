import { db } from "./db";
import { Ledger, Wallet } from "./models";

/* =========================================================
   GET / CREATE WALLET
   ========================================================= */

export async function wallet(userId: string) {
  await db();

  /*
   * Always use the wallet with the highest balance.
   *
   * This also protects against old duplicate wallet
   * documents that may exist for the same user.
   */
  const existing = await Wallet.findOne({
    userId,
  }).sort({
    balanceKobo: -1,
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
  } catch (error: any) {
    /*
     * Another request may have created the wallet
     * at exactly the same time.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const created = await Wallet.findOne({
        userId,
      }).sort({
        balanceKobo: -1,
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

  if (
    !Number.isInteger(kobo) ||
    kobo <= 0
  ) {
    throw new Error("INVALID_AMOUNT");
  }

  if (!ref?.trim()) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /*
   * IDEMPOTENCY
   */
  const existing =
    await Ledger.findOne({
      reference: ref,
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
      existing.type !== "CREDIT" ||
      Number(existing.amountKobo) !== kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    return await wallet(userId);
  }

  const w = await wallet(userId);

  /*
   * Atomic credit.
   */
  const n =
    await Wallet.findByIdAndUpdate(
      w._id,
      {
        $inc: {
          balanceKobo: kobo,
        },
      },
      {
        new: true,
      }
    );

  if (!n) {
    throw new Error(
      "WALLET_NOT_FOUND"
    );
  }

  try {
    await Ledger.create({
      userId,
      type: "CREDIT",
      amountKobo: kobo,
      balanceAfterKobo:
        n.balanceKobo,
      reference: ref,
      status: "POSTED",
      metadata,
    });
  } catch (error: any) {
    /*
     * Duplicate ledger reference.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const duplicate =
        await Ledger.findOne({
          reference: ref,
        });

      if (
        duplicate &&
        String(duplicate.userId) ===
          String(userId) &&
        duplicate.type === "CREDIT" &&
        Number(
          duplicate.amountKobo
        ) === kobo
      ) {
        await Wallet.findByIdAndUpdate(
          w._id,
          {
            $inc: {
              balanceKobo: -kobo,
            },
          }
        );

        return await wallet(userId);
      }
    }

    /*
     * Restore wallet if ledger creation failed.
     */
    await Wallet.findByIdAndUpdate(
      w._id,
      {
        $inc: {
          balanceKobo: -kobo,
        },
      }
    );

    throw error;
  }

  return n;
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

  if (
    !Number.isInteger(kobo) ||
    kobo <= 0
  ) {
    throw new Error("INVALID_AMOUNT");
  }

  if (!ref?.trim()) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /*
   * IDEMPOTENCY
   */
  const existing =
    await Ledger.findOne({
      reference: ref,
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
      existing.type !== "DEBIT" ||
      Number(existing.amountKobo) !== kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    return await wallet(userId);
  }

  /*
   * IMPORTANT:
   *
   * Use the same wallet selected by wallet()
   * which now selects the highest-balance wallet.
   */
  const w = await wallet(userId);

  /*
   * Atomic balance check + debit.
   */
  const n =
    await Wallet.findOneAndUpdate(
      {
        _id: w._id,
        balanceKobo: {
          $gte: kobo,
        },
      },
      {
        $inc: {
          balanceKobo: -kobo,
        },
      },
      {
        new: true,
      }
    );

  if (!n) {
    /*
     * Give a precise error instead of silently
     * hiding a wallet mismatch.
     */
    const currentWallet =
  (await Wallet.findOne({
    userId,
  }).lean()) as {
    balanceKobo?: number;
  } | null;

const currentBalanceKobo =
  Number(
    currentWallet?.balanceKobo || 0
  );

    const error =
    currentBalanceKobo <= 0
      ? "Insufficient wallet balance."
      : `Insufficient wallet balance. Your available balance is ₦${(
          currentBalanceKobo / 100
        ).toLocaleString("en-NG", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`;

  throw new Error(error);
}

  try {
    await Ledger.create({
      userId,
      type: "DEBIT",
      amountKobo: kobo,
      balanceAfterKobo:
        n.balanceKobo,
      reference: ref,
      status: "POSTED",
      metadata,
    });
  } catch (error: any) {
    /*
     * Another request may have created
     * the same ledger reference.
     */
    if (
      /duplicate|E11000|unique/i.test(
        error?.message || ""
      )
    ) {
      const duplicate =
        await Ledger.findOne({
          reference: ref,
        });

      if (
        duplicate &&
        String(
          duplicate.userId
        ) === String(userId) &&
        duplicate.type === "DEBIT" &&
        Number(
          duplicate.amountKobo
        ) === kobo
      ) {
        await Wallet.findByIdAndUpdate(
          w._id,
          {
            $inc: {
              balanceKobo: kobo,
            },
          }
        );

        return await wallet(userId);
      }
    }

    /*
     * Ledger failed.
     *
     * Restore the debit.
     */
    await Wallet.findByIdAndUpdate(
      w._id,
      {
        $inc: {
          balanceKobo: kobo,
        },
      }
    );

    throw error;
  }

  return n;
}