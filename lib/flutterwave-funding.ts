
import mongoose from "mongoose";
import { db } from "@/lib/db";
import { User, Funding, Ledger } from "@/lib/models";
import { creditWalletInSession } from "@/lib/ledger";

export async function processFlutterwaveTransaction(
  transactionId: string
) {
  if (!/^\d+$/.test(transactionId)) {
    throw new Error("Invalid Flutterwave transaction ID.");
  }

  const secretKey = process.env.FLW_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Flutterwave is not configured.");
  }

  // Verify directly with Flutterwave. Never trust callback parameters alone.
  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
      transactionId
    )}/verify`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const verification: any = await response.json().catch(() => null);
  const tx: any = verification?.data;

  if (
    !response.ok ||
    verification?.status !== "success" ||
    tx?.status !== "successful"
  ) {
    throw new Error("Flutterwave transaction could not be verified.");
  }

  const txRef = String(tx?.tx_ref || "").trim();
  const currency = String(tx?.currency || "").toUpperCase();
  const amountNaira = Number(tx?.amount);

  if (
    !txRef ||
    currency !== "NGN" ||
    !Number.isFinite(amountNaira) ||
    amountNaira <= 0
  ) {
    throw new Error("Invalid Flutterwave transaction details.");
  }

  const amountKobo = Math.round(amountNaira * 100);

  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
    throw new Error("Invalid payment amount.");
  }

  await db();

  const session = await mongoose.startSession();

  try {
    let result: any;

    await session.withTransaction(async () => {
      /*
       * FIRST: Hosted checkout funding.
       */
      const funding: any = await Funding.findOne({
        reference: txRef,
      })
        .session(session)
        .lean();

      if (funding) {
        // Do not allow a Flutterwave transaction to process
        // a funding record belonging to another provider.
        if (!txRef.startsWith("DZT-FLW-FUND-")) {
          throw new Error("Funding reference is not a Flutterwave reference.");
        }

        if (
          !funding.userId ||
          !Number.isSafeInteger(Number(funding.grossKobo)) ||
          !Number.isSafeInteger(Number(funding.creditKobo)) ||
          Number(funding.grossKobo) <= 0 ||
          Number(funding.creditKobo) <= 0 ||
          amountKobo !== Number(funding.grossKobo)
        ) {
          throw new Error("Payment does not match the funding record.");
        }

        // Already credited: never credit this funding a second time.
        if (funding.status === "CREDITED") {
  const existingLedger = await Ledger.findOne({
    reference: `FLW-FUND-${txRef}`,
  }).session(session);

  if (!existingLedger) {
    throw new Error(
      "Funding is marked credited but its wallet ledger entry is missing. Manual reconciliation is required."
    );
  }

  if (
    String(existingLedger.userId) !== String(funding.userId) ||
    existingLedger.type !== "CREDIT" ||
    Number(existingLedger.amountKobo) !== Number(funding.creditKobo)
  ) {
    throw new Error("Existing funding ledger does not match the funding record.");
  }

  result = {
    success: true,
    alreadyCredited: true,
    type: "HOSTED_CHECKOUT",
    reference: txRef,
  };
  return;
}

        await creditWalletInSession(
          String(funding.userId),
          Number(funding.creditKobo),
          `FLW-FUND-${txRef}`,
          session,
          {
            source: "FLUTTERWAVE_HOSTED_CHECKOUT",
            provider: "FLUTTERWAVE",
            providerTransactionId: transactionId,
            txRef,
            currency,
            grossKobo: Number(funding.grossKobo),
            feeKobo: Number(funding.feeKobo || 0),
            creditKobo: Number(funding.creditKobo),
          }
        );

        const update = await Funding.updateOne(
          {
            _id: funding._id,
            status: { $ne: "CREDITED" },
          },
          {
            $set: {
              status: "CREDITED",
              "providerData.provider": "FLUTTERWAVE",
              "providerData.paymentType": "HOSTED_CHECKOUT",
              "providerData.transactionId": transactionId,
              "providerData.txRef": txRef,
              "providerData.verifiedAmountKobo": amountKobo,
              "providerData.verifiedAt": new Date(),
            },
          },
          { session }
        );

        if (update.matchedCount !== 1) {
          throw new Error("Funding status could not be updated.");
        }

        result = {
          success: true,
          type: "HOSTED_CHECKOUT",
          reference: txRef,
        };

        return;
      }

      /*
       * SECOND: Permanent Flutterwave virtual-account funding.
       */
      const user: any = await User.findOne({
        "kyc.flutterwaveTxRef": txRef,
        "kyc.flutterwaveDvaStatus": "ACTIVE",
        "kyc.flutterwaveAccountNumber": { $exists: true, $ne: "" },
      })
        .select("_id kyc")
        .session(session)
        .lean();

      if (!user) {
        throw new Error("No matching active Flutterwave customer account.");
      }

      await creditWalletInSession(
        String(user._id),
        amountKobo,
        `FLW-DVA-${transactionId}`,
        session,
        {
          source: "FLUTTERWAVE_STATIC_VIRTUAL_ACCOUNT",
          provider: "FLUTTERWAVE",
          providerTransactionId: transactionId,
          txRef,
          currency,
          accountNumber: String(user.kyc.flutterwaveAccountNumber),
        }
      );

      result = {
        success: true,
        type: "STATIC_VIRTUAL_ACCOUNT",
        reference: txRef,
      };
    });

    if (!result) {
      throw new Error("Flutterwave payment processing did not complete.");
    }

    return result;
  } finally {
    await session.endSession();
  }
}
