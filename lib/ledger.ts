import { db } from "./db";
import { Ledger, Wallet } from "./models";

/* =========================================================
   GET / CREATE WALLET
   ========================================================= */

export async function wallet(userId: string) {
  await db();

  const existing = await Wallet.findOne({
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
  } catch (error: any) {
    /*
     * Another request may have created the wallet
     * at exactly the same time.
     *
     * Fetch it again instead of failing.
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

  if (
    !Number.isInteger(kobo) ||
    kobo <= 0
  ) {
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  if (!ref?.trim()) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /*
   * IDEMPOTENCY:
   *
   * If this exact credit reference has already
   * been posted, NEVER credit the wallet again.
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
      Number(existing.amountKobo) !==
        kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    const existingWallet =
      await wallet(userId);

    return existingWallet;
  }

  const w =
    await wallet(userId);

  /*
   * Atomic wallet increment.
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
     * A concurrent request may have created the
     * exact same ledger reference.
     *
     * IMPORTANT:
     *
     * In that situation we must undo ONLY our
     * wallet increment.
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
        duplicate.type ===
          "CREDIT" &&
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

        return await wallet(
          userId
        );
      }
    }

    /*
     * Ledger creation failed for another reason.
     *
     * Undo the wallet movement so the wallet
     * cannot remain incorrectly credited.
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
    throw new Error(
      "INVALID_AMOUNT"
    );
  }

  if (!ref?.trim()) {
    throw new Error(
      "INVALID_LEDGER_REFERENCE"
    );
  }

  /*
   * IDEMPOTENCY:
   *
   * If this exact debit already exists,
   * NEVER debit the wallet again.
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
      Number(existing.amountKobo) !==
        kobo
    ) {
      throw new Error(
        "LEDGER_REFERENCE_CONFLICT"
      );
    }

    return await wallet(
      userId
    );
  }

  const w =
    await wallet(userId);

  /*
   * Atomic balance check + decrement.
   *
   * This prevents two simultaneous purchases
   * from spending the same balance.
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
    throw new Error(
      "INSUFFICIENT_BALANCE"
    );
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
     * Another request may have posted this exact
     * reference concurrently.
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
        duplicate.type ===
          "DEBIT" &&
        Number(
          duplicate.amountKobo
        ) === kobo
      ) {
        /*
         * Our debit must be undone because the
         * other request owns the successful ledger
         * entry.
         */
        await Wallet.findByIdAndUpdate(
          w._id,
          {
            $inc: {
              balanceKobo: kobo,
            },
          }
        );

        return await wallet(
          userId
        );
      }
    }

    /*
     * Ledger failed.
     *
     * Restore the wallet balance.
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