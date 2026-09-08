import { NextResponse } from "next/server";

import { requirePin } from "@/lib/authz";
import { db } from "@/lib/db";
import { Withdrawal } from "@/lib/models";
import { getRates } from "@/lib/settings";
import { debitWallet, creditWallet } from "@/lib/ledger";
import { currentUserId } from "@/lib/session";

function generateReference() {
  return `wd_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export async function POST(req: Request) {
  let withdrawal: any = null;
  let debited = false;

  try {
    /* =========================================================
       AUTHENTICATION
       ========================================================= */

    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /* =========================================================
       READ REQUEST
       ========================================================= */

    const body = await req.json();

    const amount = Number(body.amount);
    const pin = String(body.pin || "").trim();

    const accountNumber = String(
      body.accountNumber || ""
    ).trim();

    const bankCode = String(
      body.bankCode || ""
    ).trim();

    const bankName = String(
      body.bankName || ""
    ).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "Enter a valid withdrawal amount.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        {
          error: "Enter your 4-digit PIN.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Enter a valid 10-digit account number.",
        },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        {
          error: "Bank code is required.",
        },
        { status: 400 }
      );
    }

    if (!bankName) {
      return NextResponse.json(
        {
          error: "Bank name is required.",
        },
        { status: 400 }
      );
    }

    /* =========================================================
       CONVERT TO KOBO
       ========================================================= */

    const amountKobo = Math.round(amount * 100);

    if (
      !Number.isSafeInteger(amountKobo) ||
      amountKobo <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid withdrawal amount.",
        },
        { status: 400 }
      );
    }

    /* =========================================================
       GET WITHDRAWAL FEE
       ========================================================= */

    const rates = await getRates();

    const withdrawalRate = Number(
      rates.withdrawal ?? 0
    );

    if (
      !Number.isFinite(withdrawalRate) ||
      withdrawalRate < 0 ||
      withdrawalRate > 5
    ) {
      return NextResponse.json(
        {
          error:
            "Withdrawal fee configuration is invalid.",
        },
        { status: 500 }
      );
    }

    const feeKobo = Math.ceil(
      (amountKobo * withdrawalRate) / 100
    );

    const payoutKobo =
      amountKobo - feeKobo;

    if (payoutKobo <= 0) {
      return NextResponse.json(
        {
          error:
            "Withdrawal amount is too small after fees.",
        },
        { status: 400 }
      );
    }

    /* =========================================================
       VERIFY TRANSACTION PIN
       ========================================================= */

    await requirePin(pin);

    /* =========================================================
       PAYSTACK CONFIG
       ========================================================= */

    const secret =
      process.env.PAYSTACK_SECRET_KEY || "";

    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Payment service is not configured.",
        },
        { status: 500 }
      );
    }

    /* =========================================================
       VERIFY BANK ACCOUNT AGAIN ON SERVER
       ========================================================= */

    const resolveUrl =
      "https://api.paystack.co/bank/resolve" +
      `?account_number=${encodeURIComponent(
        accountNumber
      )}` +
      `&bank_code=${encodeURIComponent(
        bankCode
      )}`;

    const resolveResponse = await fetch(
      resolveUrl,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const resolveText =
      await resolveResponse.text();

    let resolveResult: any = {};

    try {
      resolveResult = resolveText
        ? JSON.parse(resolveText)
        : {};
    } catch {
      return NextResponse.json(
        {
          error:
            "Paystack returned an invalid account verification response.",
        },
        { status: 502 }
      );
    }

    if (
      !resolveResponse.ok ||
      !resolveResult.status
    ) {
      return NextResponse.json(
        {
          error:
            resolveResult.message ||
            "Unable to verify this bank account.",
        },
        {
          status:
            resolveResponse.status || 400,
        }
      );
    }

    const resolvedData =
      resolveResult.data || {};

    const resolvedAccountNumber =
      String(
        resolvedData.account_number ||
          accountNumber
      ).trim();

    const accountName = String(
      resolvedData.account_name || ""
    ).trim();

    if (!accountName) {
      return NextResponse.json(
        {
          error:
            "Unable to retrieve the account name.",
        },
        { status: 400 }
      );
    }

    /* =========================================================
       DATABASE
       ========================================================= */

    await db();

    const reference =
      generateReference();

    /* =========================================================
       CREATE WITHDRAWAL RECORD
       ========================================================= */

    withdrawal =
      await Withdrawal.create({
        userId,

        reference,

        amountKobo,

        feeKobo,

        payoutKobo,

        status: "PENDING",

        bankCode,

        bankName,

        accountNumber:
          resolvedAccountNumber,

        accountName,

        reason: "Customer withdrawal",
      });

    /* =========================================================
       DEBIT FULL WITHDRAWAL AMOUNT
       ========================================================= */

    await debitWallet(
      userId,
      amountKobo,
      `withdrawal_${reference}`,
      {
        withdrawalId:
          withdrawal._id.toString(),

        withdrawalReference:
          reference,

        withdrawalAmountKobo:
          amountKobo,

        feeKobo,

        payoutKobo,
      }
    );

    debited = true;

    /* =========================================================
       CREATE PAYSTACK TRANSFER RECIPIENT
       ========================================================= */

    const recipientResponse =
      await fetch(
        "https://api.paystack.co/transferrecipient",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            type: "nuban",

            name: accountName,

            account_number:
              resolvedAccountNumber,

            bank_code: bankCode,

            currency: "NGN",
          }),

          cache: "no-store",
        }
      );

    const recipientText =
      await recipientResponse.text();

    let recipientResult: any = {};

    try {
      recipientResult = recipientText
        ? JSON.parse(recipientText)
        : {};
    } catch {
      throw new Error(
        "Paystack returned an invalid recipient response."
      );
    }

    if (
      !recipientResponse.ok ||
      !recipientResult.status ||
      !recipientResult.data?.recipient_code
    ) {
      throw new Error(
        recipientResult.message ||
          "Unable to create Paystack recipient."
      );
    }

    const recipientCode =
      recipientResult.data.recipient_code;

    withdrawal.recipientCode =
      recipientCode;

    await withdrawal.save();

    /* =========================================================
       INITIATE PAYSTACK TRANSFER
       ========================================================= */

    const paystackReference =
      reference.toLowerCase();

    const transferResponse =
      await fetch(
        "https://api.paystack.co/transfer",
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${secret}`,
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            source: "balance",

            amount: payoutKobo,

            recipient: recipientCode,

            reason:
              `Withdrawal ${reference}`,

            reference:
              paystackReference,
          }),

          cache: "no-store",
        }
      );

    const transferText =
      await transferResponse.text();

    let transferResult: any = {};

    try {
      transferResult = transferText
        ? JSON.parse(transferText)
        : {};
    } catch {
      throw new Error(
        "Paystack returned an invalid transfer response."
      );
    }

    /* =========================================================
       TRANSFER REQUEST FAILED
       ========================================================= */

    if (
      !transferResponse.ok ||
      !transferResult.status
    ) {
      throw new Error(
        transferResult.message ||
          "Unable to initiate withdrawal transfer."
      );
    }

    const transferData =
      transferResult.data || {};

    const transferStatus =
      String(
        transferData.status || ""
      ).toLowerCase();

    /* =========================================================
       SAVE PAYSTACK DETAILS
       ========================================================= */

    withdrawal.paystackReference =
      transferData.reference ||
      paystackReference;

    withdrawal.paystackTransferCode =
      transferData.transfer_code ||
      undefined;

    withdrawal.paystackData =
      transferData;

    /*
     * Do NOT mark SUCCESS here.
     *
     * Paystack webhook will give the final
     * transfer.success / failed / reversed
     * event.
     */

    if (
      transferStatus === "failed" ||
      transferStatus === "reversed"
    ) {
      withdrawal.status =
        transferStatus === "reversed"
          ? "REVERSED"
          : "FAILED";

      withdrawal.error =
        transferData.reason ||
        "Paystack transfer failed.";

      withdrawal.failedAt =
        new Date();

      if (
        transferStatus === "reversed"
      ) {
        withdrawal.reversedAt =
          new Date();
      }

      await withdrawal.save();

      /* =======================================================
         REFUND FULL WALLET DEBIT
         ======================================================= */

      await creditWallet(
        userId,
        amountKobo,
        `withdrawal_refund_${reference}`,
        {
          withdrawalId:
            withdrawal._id.toString(),

          withdrawalReference:
            reference,

          reason:
            `Withdrawal ${transferStatus}`,
        }
      );

      debited = false;

      return NextResponse.json(
        {
          success: false,

          error:
            transferData.reason ||
            "Withdrawal transfer failed. Your wallet has been refunded.",
        },
        { status: 400 }
      );
    }

    /* =========================================================
       PROCESSING
       ========================================================= */

    withdrawal.status =
      "PROCESSING";

    await withdrawal.save();

    return NextResponse.json({
      success: true,

      message:
        "Withdrawal initiated successfully. Your transfer is being processed.",

      withdrawal: {
        reference,

        amount: amountKobo / 100,

        fee: feeKobo / 100,

        payout:
          payoutKobo / 100,

        status:
          withdrawal.status,

        bankName,

        accountNumber:
          resolvedAccountNumber,

        accountName,
      },
    });
    } catch (error: any) {
    console.error(
      "WITHDRAWAL CREATE ERROR:",
      error
    );

    /*
     * Refund if wallet was already debited.
     */
    if (
      withdrawal &&
      debited
    ) {
      try {
        await creditWallet(
          String(withdrawal.userId),
          Number(
            withdrawal.amountKobo
          ),
          `withdrawal_refund_${withdrawal.reference}`,
          {
            withdrawalId:
              withdrawal._id.toString(),

            withdrawalReference:
              withdrawal.reference,

            reason:
              "Withdrawal initiation failed",
          }
        );

        withdrawal.status =
          "FAILED";

        withdrawal.error =
          error?.message ||
          "Withdrawal initiation failed.";

        withdrawal.failedAt =
          new Date();

        await withdrawal.save();

        debited = false;
      } catch (refundError) {
        console.error(
          "WITHDRAWAL REFUND ERROR:",
          refundError
        );
      }
    } else if (
      withdrawal &&
      !debited &&
      withdrawal.status === "PENDING"
    ) {
      withdrawal.status =
        "FAILED";

      withdrawal.error =
        error?.message ||
        "Withdrawal failed.";

      withdrawal.failedAt =
        new Date();

      await withdrawal.save();
    }

    /*
     * Return a useful balance error.
     */
    if (
      error?.message ===
      "INSUFFICIENT_BALANCE"
    ) {
      const currentBalance =
        Number(
          error?.currentBalanceKobo ||
            0
        ) / 100;

      const requestedAmount =
        Number(
          error?.requestedKobo ||
            0
        ) / 100;

      return NextResponse.json(
        {
          error:
            `Insufficient wallet balance. Available: ₦${currentBalance.toFixed(
              2
            )}. Requested: ₦${requestedAmount.toFixed(
              2
            )}.`,
        },
        {
          status: 400,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to process withdrawal.",
      },
      {
        status: 400,
      }
    );
  }
}