import { NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/lib/db";
import {
  Funding,
  User,
  Ledger,
  ProfitWithdrawal,
  Withdrawal,
} from "@/lib/models";
import { creditWallet } from "@/lib/ledger";

/* =========================================================
   GET — WEBHOOK HEALTH CHECK
   ========================================================= */

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Paystack webhook route is live",
  });
}

/* =========================================================
   POST — PAYSTACK WEBHOOK
   ========================================================= */

export async function POST(req: Request) {
  try {
    /* =======================================================
       READ RAW BODY AND VERIFY SIGNATURE
       ======================================================= */

    const raw = await req.text();
    const signature =
      req.headers.get("x-paystack-signature") || "";
    const secret = process.env.PAYSTACK_SECRET_KEY || "";

    if (!secret) {
      console.error("PAYSTACK_SECRET_KEY is missing");

      return NextResponse.json(
        { error: "Webhook configuration error" },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha512", secret)
      .update(raw)
      .digest("hex");

    const isValidSignature =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, "utf8"),
        Buffer.from(expectedSignature, "utf8")
      );

    if (!isValidSignature) {
      console.error("Invalid Paystack webhook signature");

      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    /* =======================================================
       PARSE EVENT
       ======================================================= */

    let event: any;

    try {
      event = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    if (!event || typeof event.event !== "string") {
      return NextResponse.json(
        { error: "Invalid Paystack event" },
        { status: 400 }
      );
    }

    await db();

    console.log("PAYSTACK WEBHOOK EVENT:", event.event);

    /* =========================================================
       1. TRANSFER EVENTS — CUSTOMER AND PROFIT WITHDRAWALS
       ========================================================= */

    const transferEvents = [
      "transfer.success",
      "transfer.failed",
      "transfer.reversed",
    ];

    if (transferEvents.includes(event.event)) {
      const data = event.data || {};
      const reference = String(data.reference || "").trim();

      if (!reference) {
        console.error("Transfer event without reference");

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         CUSTOMER WITHDRAWAL
         ===================================================== */

      const customerWithdrawal: any =
        await Withdrawal.findOne({
          $or: [
            { reference },
            { paystackReference: reference },
          ],
        });

      if (customerWithdrawal) {
        customerWithdrawal.paystackData = data;

        if (data.transfer_code) {
          customerWithdrawal.paystackTransferCode =
            data.transfer_code;
        }

        if (event.event === "transfer.success") {
          if (
            customerWithdrawal.status === "PENDING" ||
            customerWithdrawal.status === "PROCESSING"
          ) {
            customerWithdrawal.status = "SUCCESS";
            customerWithdrawal.completedAt = new Date();
            customerWithdrawal.error = undefined;
          }

          await customerWithdrawal.save();

          return NextResponse.json({ ok: true });
        }

        if (
          event.event === "transfer.failed" ||
          event.event === "transfer.reversed"
        ) {
          const shouldRefund =
            customerWithdrawal.status === "PENDING" ||
            customerWithdrawal.status === "PROCESSING";

          if (shouldRefund) {
            const refundReference =
              `withdrawal_refund_${customerWithdrawal.reference}`;

            try {
              await creditWallet(
                String(customerWithdrawal.userId),
                Number(customerWithdrawal.amountKobo),
                refundReference,
                {
                  withdrawalId:
                    customerWithdrawal._id.toString(),
                  withdrawalReference:
                    customerWithdrawal.reference,
                  reason:
                    event.event === "transfer.reversed"
                      ? "Paystack withdrawal reversed"
                      : "Paystack withdrawal failed",
                  paystack: data,
                }
              );
            } catch (refundError: any) {
              const message = String(
                refundError?.message || ""
              ).toLowerCase();

              const duplicate =
                message.includes("duplicate") ||
                message.includes("e11000");

              if (!duplicate) {
                console.error(
                  "Customer withdrawal refund failed",
                  refundError
                );

                return NextResponse.json(
                  { error: "Withdrawal refund failed" },
                  { status: 500 }
                );
              }
            }

            customerWithdrawal.status =
              event.event === "transfer.reversed"
                ? "REVERSED"
                : "FAILED";

            customerWithdrawal.error = String(
              data.reason ||
                data.failures ||
                (event.event === "transfer.reversed"
                  ? "Paystack transfer was reversed"
                  : "Paystack transfer failed")
            );

            customerWithdrawal.failedAt = new Date();

            if (event.event === "transfer.reversed") {
              customerWithdrawal.reversedAt = new Date();
            }
          }

          await customerWithdrawal.save();

          return NextResponse.json({ ok: true });
        }
      }

      /* =====================================================
         ADMIN / PROFIT WITHDRAWAL
         ===================================================== */

      const profitWithdrawal: any =
        await ProfitWithdrawal.findOne({
          $or: [
            { reference },
            { paystackReference: reference },
          ],
        });

      if (profitWithdrawal) {
        profitWithdrawal.paystackData = data;

        if (data.transfer_code) {
          profitWithdrawal.paystackTransferCode =
            data.transfer_code;
        }

        const terminalStatuses = [
          "SUCCESS",
          "FAILED",
          "REVERSED",
        ];

        if (
          !terminalStatuses.includes(
            profitWithdrawal.status
          )
        ) {
          if (event.event === "transfer.success") {
            profitWithdrawal.status = "SUCCESS";
            profitWithdrawal.completedAt = new Date();
            profitWithdrawal.error = undefined;
          } else if (event.event === "transfer.failed") {
            profitWithdrawal.status = "FAILED";
            profitWithdrawal.error = String(
              data.reason ||
                data.failures ||
                "Paystack transfer failed"
            );
          } else if (
            event.event === "transfer.reversed"
          ) {
            profitWithdrawal.status = "REVERSED";
            profitWithdrawal.error = String(
              data.reason ||
                "Paystack transfer was reversed"
            );
          }
        }

        await profitWithdrawal.save();

        return NextResponse.json({ ok: true });
      }

      console.log("Transfer reference not found:", reference);

      return NextResponse.json({ ok: true });
    }

    /* =========================================================
       2. CHARGE SUCCESS — CHECKOUT OR DIRECT DVA
       ========================================================= */

    if (event.event === "charge.success") {
      const data = event.data || {};

      const reference = String(data.reference || "").trim();
      const amountKobo = Number(data.amount || 0);

      const channel = String(
        data.authorization?.channel ||
          data.channel ||
          ""
      )
        .trim()
        .toLowerCase();

      const receiverAccountNumber = String(
        data.authorization?.receiver_bank_account_number ||
          data.metadata?.receiver_account_number ||
          data.receiver_bank_account_number ||
          data.dedicated_account?.account_number ||
          ""
      ).trim();

      const receiverBank = String(
        data.authorization?.receiver_bank ||
          data.metadata?.receiver_bank ||
          data.receiver_bank ||
          ""
      ).trim();

      const customerEmail = String(
        data.customer?.email || data.email || ""
      )
        .trim()
        .toLowerCase();

      const customerCode = String(
        data.customer?.customer_code ||
          data.customer_code ||
          ""
      ).trim();

      const isDvaCharge = channel === "dedicated_nuban";

      console.log("PAYSTACK CHARGE SUCCESS:", {
        reference,
        amountKobo,
        channel,
        currency: data.currency || null,
        isDvaCharge,
      });

      /* =====================================================
         BASIC CHARGE VALIDATION
         ===================================================== */

      if (
        !reference ||
        !Number.isSafeInteger(amountKobo) ||
        amountKobo <= 0 ||
        String(data.status || "").toLowerCase() !== "success" ||
        String(data.currency || "").toUpperCase() !== "NGN"
      ) {
        console.error("Invalid Paystack charge details", {
          reference,
          amountKobo,
          status: data.status,
          currency: data.currency,
        });

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         2A. DIRECT DVA FUNDING
         ===================================================== */

      if (isDvaCharge) {
        let user: any = null;

        if (receiverAccountNumber) {
          const accountConditions: any[] = [
            {
              "kyc.accountNumber": receiverAccountNumber,
            },
          ];

          if (/^\d+$/.test(receiverAccountNumber)) {
            accountConditions.push({
              "kyc.accountNumber": Number(
                receiverAccountNumber
              ),
            });
          }

          user = await User.findOne({
            $or: accountConditions,
          });
        }

        if (!user && customerCode) {
          user = await User.findOne({
            "kyc.customerCode": customerCode,
          });
        }

        if (!user && customerEmail) {
          const escapedEmail = customerEmail.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

          user = await User.findOne({
            email: {
              $regex: `^${escapedEmail}$`,
              $options: "i",
            },
          });
        }

        if (!user) {
          console.error("DVA user not found", {
            receiverAccountNumber,
            customerEmail,
            customerCode,
            reference,
          });

          // Acknowledge this event for manual investigation.
          return NextResponse.json({ ok: true });
        }

        const dvaReference = `DVA-${reference}`;

        const existingLedger: any =
          await Ledger.findOne({
            reference: dvaReference,
          });

        if (existingLedger) {
          console.log("DVA payment already credited:", reference);

          return NextResponse.json({ ok: true });
        }

        await creditWallet(
          String(user._id),
          amountKobo,
          dvaReference,
          {
            source: "PAYSTACK_DEDICATED_VIRTUAL_ACCOUNT",
            paystackReference: reference,
            receiverAccountNumber,
            receiverBank,
            customerEmail,
            customerCode,
            paystack: data,
          }
        );

        console.log("DVA wallet credited:", {
          userId: String(user._id),
          reference,
          amountKobo,
          ledgerReference: dvaReference,
        });

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         2B. NORMAL WALLET FUNDING — V2 CHECKOUTS ONLY
         ===================================================== */

      /*
       * New checkout references must start with DZT-FUND-V2-.
       * Older checkout references are ignored.
       * No old checkout payment is re-queried or credited here.
       * DVA payments are handled separately above.
       */

      if (!reference.startsWith("DZT-FUND-V2-")) {
        console.log("Legacy checkout ignored:", reference);

        return NextResponse.json({
          ok: true,
          ignored: "legacy_checkout",
        });
      }

      /* =====================================================
         VERIFY NEW CHECKOUT METADATA
         ===================================================== */

      const metadata = data.metadata || {};

      if (
        String(metadata.fundingReference || "").trim() !==
          reference ||
        !String(metadata.userId || "").trim()
      ) {
        console.error("Invalid V2 checkout metadata", {
          reference,
          metadataReference:
            metadata.fundingReference || null,
        });

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         FIND NEW FUNDING RECORD
         ===================================================== */

      const funding: any = await Funding.findOne({
        reference,
      });

      if (!funding) {
        console.error("V2 funding record not found:", {
          reference,
          amountKobo,
        });

        // Do not create a Funding record from webhook metadata.
        // Return an error for this new checkout event.
        return NextResponse.json(
          { error: "V2 funding record not found" },
          { status: 500 }
        );
      }

      /* =====================================================
         VERIFY CUSTOMER AND AMOUNT
         ===================================================== */

      if (
        String(funding.userId) !==
          String(metadata.userId) ||
        amountKobo !== Number(funding.grossKobo) ||
        amountKobo !== Number(metadata.fundingAmountKobo)
      ) {
        console.error("V2 funding validation failed", {
          reference,
          webhookAmountKobo: amountKobo,
          expectedGrossKobo: Number(funding.grossKobo),
          metadataAmountKobo: Number(
            metadata.fundingAmountKobo
          ),
        });

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         ALREADY CREDITED
         ===================================================== */

      if (funding.status === "CREDITED") {
        console.log("V2 funding already credited:", reference);

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         IDEMPOTENCY — CHECK EXISTING LEDGER
         ===================================================== */

      const ledgerReference = `FUND-${reference}`;

      const existingFundingLedger: any =
        await Ledger.findOne({
          reference: ledgerReference,
        });

      if (existingFundingLedger) {
        funding.status = "CREDITED";
        funding.providerData = data;
        funding.paystackReference = reference;

        await funding.save();

        console.log(
          "V2 funding ledger already exists:",
          ledgerReference
        );

        return NextResponse.json({ ok: true });
      }

      /* =====================================================
         CREDIT CUSTOMER WALLET
         ===================================================== */

      await creditWallet(
        String(funding.userId),
        Number(funding.creditKobo),
        ledgerReference,
        {
          source: "PAYSTACK_FUNDING",
          paystack: data,
          feeKobo: Number(funding.feeKobo || 0),
        }
      );

      /* =====================================================
         MARK FUNDING COMPLETE
         ===================================================== */

      funding.status = "CREDITED";
      funding.providerData = data;
      funding.paystackReference = reference;

      await funding.save();

      console.log("V2 funding wallet credited:", {
        userId: String(funding.userId),
        reference: funding.reference,
        grossKobo: funding.grossKobo,
        creditKobo: funding.creditKobo,
        feeKobo: funding.feeKobo,
        ledgerReference,
      });

      return NextResponse.json({ ok: true });
    }

    /* =========================================================
       3. DVA ASSIGNMENT SUCCESS
       ========================================================= */

    if (event.event === "dedicatedaccount.assign.success") {
      const data = event.data || {};
      const customer = data.customer || {};

      const email = String(
        customer.email || data.email || ""
      )
        .trim()
        .toLowerCase();

      const customerCode = String(
        customer.customer_code ||
          data.customer_code ||
          ""
      ).trim();

      const accountNumber = String(
        data.account_number ||
          data.account?.account_number ||
          data.dedicated_account?.account_number ||
          ""
      ).trim();

      const accountName = String(
        data.account_name ||
          data.account?.account_name ||
          data.account?.name ||
          data.dedicated_account?.account_name ||
          ""
      ).trim();

      const bankName = String(
        data.bank?.name ||
          data.account?.bank?.name ||
          data.dedicated_account?.bank?.name ||
          data.bank_name ||
          data.bankName ||
          ""
      ).trim();

      if (!accountNumber) {
        console.error(
          "DVA assignment success event has no account number"
        );

        return NextResponse.json({ ok: true });
      }

      const conditions: any[] = [];

      if (customerCode) {
        conditions.push({
          "kyc.customerCode": customerCode,
        });
      }

      if (email) {
        const escapedEmail = email.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        conditions.push({
          email: {
            $regex: `^${escapedEmail}$`,
            $options: "i",
          },
        });
      }

      if (conditions.length === 0) {
        console.error("DVA assignment user identification failed");

        return NextResponse.json({ ok: true });
      }

      const updatedUser = (await User.findOneAndUpdate(
        { $or: conditions },
        {
          $set: {
            "kyc.accountNumber": accountNumber,
            "kyc.accountName": accountName,
            "kyc.bankName": bankName,
            "kyc.customerCode": customerCode,
            "kyc.dvaStatus": "ACTIVE",
          },
        },
        {
          new: true,
          runValidators: true,
        }
      ).lean()) as any;

      if (!updatedUser) {
        console.error("DVA assignment user not found");

        return NextResponse.json({ ok: true });
      }

      console.log("DVA account assignment saved:", {
        userId: String(updatedUser._id),
        email: updatedUser.email,
        accountNumber: updatedUser.kyc?.accountNumber,
        bankName: updatedUser.kyc?.bankName,
      });

      return NextResponse.json({ ok: true });
    }

    /* =========================================================
       4. DVA ASSIGNMENT FAILED
       ========================================================= */

    if (event.event === "dedicatedaccount.assign.failed") {
      const data = event.data || {};
      const customer = data.customer || {};

      const email = String(
        customer.email || data.email || ""
      )
        .trim()
        .toLowerCase();

      const customerCode = String(
        customer.customer_code ||
          data.customer_code ||
          ""
      ).trim();

      const reason = String(
        data.reason ||
          data.message ||
          "Dedicated account assignment failed"
      ).trim();

      console.error("Paystack DVA assignment failed:", {
        email,
        customerCode,
        reason,
      });

      const conditions: any[] = [];

      if (customerCode) {
        conditions.push({
          "kyc.customerCode": customerCode,
        });
      }

      if (email) {
        const escapedEmail = email.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );

        conditions.push({
          email: {
            $regex: `^${escapedEmail}$`,
            $options: "i",
          },
        });
      }

      if (conditions.length > 0) {
        await User.findOneAndUpdate(
          { $or: conditions },
          {
            $set: {
              "kyc.dvaStatus": "FAILED",
            },
          },
          {
            runValidators: true,
          }
        );
      }

      return NextResponse.json({ ok: true });
    }

    /* =========================================================
       5. UNKNOWN / OTHER PAYSTACK EVENTS
       ========================================================= */

    console.log("Paystack event acknowledged:", event.event);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("PAYSTACK WEBHOOK PROCESSING ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}