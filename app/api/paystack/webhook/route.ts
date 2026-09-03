import { NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/lib/db";
import {
  Funding,
  User,
  ProfitWithdrawal,
} from "@/lib/models";
import { creditWallet } from "@/lib/ledger";

export async function POST(req: Request) {
  try {
    /* =========================================================
       READ RAW BODY
       ========================================================= */

    const raw = await req.text();

    const sig =
      req.headers.get("x-paystack-signature") || "";

    const secret =
      process.env.PAYSTACK_SECRET_KEY || "";

    if (!secret) {
      console.error(
        "=== PAYSTACK WEBHOOK ERROR ==="
      );
      console.error(
        "PAYSTACK_SECRET_KEY is missing"
      );

      return NextResponse.json(
        { error: "Webhook configuration error" },
        { status: 500 }
      );
    }

    /* =========================================================
       VERIFY PAYSTACK SIGNATURE
       ========================================================= */

    const expected = crypto
      .createHmac("sha512", secret)
      .update(raw)
      .digest("hex");

    if (
      !sig ||
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    ) {
      console.error(
        "=== INVALID PAYSTACK WEBHOOK SIGNATURE ==="
      );

      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    /* =========================================================
       PARSE EVENT
       ========================================================= */

    let e: any;

    try {
      e = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    await db();

    console.log(
      "=== PAYSTACK WEBHOOK EVENT ==="
    );

    console.log(
      JSON.stringify(e, null, 2)
    );

    /* =========================================================
       TRANSFER EVENTS
       ========================================================= */

    const transferEvents = [
      "transfer.success",
      "transfer.failed",
      "transfer.reversed",
    ];

    if (transferEvents.includes(e.event)) {
      const data = e.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      if (reference) {
        const withdrawal: any =
          await ProfitWithdrawal.findOne({
            $or: [
              {
                reference,
              },
              {
                paystackReference:
                  reference,
              },
            ],
          });

        if (withdrawal) {
          withdrawal.paystackData = data;

          if (data.transfer_code) {
            withdrawal.paystackTransferCode =
              data.transfer_code;
          }

          if (
            e.event ===
            "transfer.success"
          ) {
            withdrawal.status =
              "SUCCESS";

            withdrawal.completedAt =
              new Date();

            withdrawal.error = undefined;
          }

          if (
            e.event ===
            "transfer.failed"
          ) {
            withdrawal.status =
              "FAILED";

            withdrawal.error =
              data.reason ||
              data.failures ||
              "Paystack transfer failed";
          }

          if (
            e.event ===
            "transfer.reversed"
          ) {
            withdrawal.status =
              "REVERSED";

            withdrawal.error =
              data.reason ||
              "Paystack transfer was reversed";
          }

          await withdrawal.save();

          console.log(
            "=== PROFIT WITHDRAWAL UPDATED ==="
          );

          console.log({
            reference,
            status:
              withdrawal.status,
          });
        }
      }
    }


    /* =========================================================
       WALLET FUNDING
       ========================================================= */

    if (e.event === "charge.success") {
      const data = e.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      if (reference) {
        const f: any =
          await Funding.findOne({
            reference,
          });

        if (
          f &&
          f.status !== "CREDITED" &&
          Number(data.amount) ===
            Number(f.grossKobo)
        ) {
          await creditWallet(
            String(f.userId),
            f.creditKobo,
            `FUND-${f.reference}`,
            {
              paystack: data,
              feeKobo: f.feeKobo,
            }
          );

          f.status = "CREDITED";
          f.providerData = data;

          await f.save();

          console.log(
            "=== WALLET CREDITED ==="
          );

          console.log({
            userId:
              String(f.userId),

            reference:
              f.reference,

            amount:
              f.creditKobo,
          });
        }
      }
    }


    /* =========================================================
       DEDICATED VIRTUAL ACCOUNT SUCCESS
       ========================================================= */

    if (
      e.event ===
      "dedicatedaccount.assign.success"
    ) {
      const d = e.data || {};

      console.log(
        "=== DVA ASSIGNMENT SUCCESS EVENT ==="
      );

      /*
      ---------------------------------------------------------
      CUSTOMER INFORMATION
      ---------------------------------------------------------
      */

      const customer =
        d.customer || {};

      const email = String(
        customer.email ||
          d.email ||
          ""
      )
        .trim()
        .toLowerCase();

      const customerCode =
        String(
          customer.customer_code ||
            d.customer_code ||
            ""
        ).trim();

      /*
      ---------------------------------------------------------
      DVA INFORMATION
      ---------------------------------------------------------
      */

      const accountNumber =
        String(
          d.account_number ||
            d.account?.account_number ||
            d.dedicated_account
              ?.account_number ||
            ""
        ).trim();

      const accountName =
        String(
          d.account_name ||
            d.account?.account_name ||
            d.account?.name ||
            d.dedicated_account
              ?.account_name ||
            ""
        ).trim();

      const bankName =
        String(
          d.bank?.name ||
            d.account?.bank?.name ||
            d.dedicated_account
              ?.bank?.name ||
            d.bank_name ||
            d.bankName ||
            ""
        ).trim();

      console.log(
        "=== DVA DETAILS RECEIVED ==="
      );

      console.log({
        email,
        customerCode,
        accountNumber,
        accountName,
        bankName,
      });

      /*
      ---------------------------------------------------------
      MAKE SURE PAYSTACK ACTUALLY SENT THE ACCOUNT
      ---------------------------------------------------------
      */

      if (!accountNumber) {
        console.error(
          "=== DVA SUCCESS EVENT HAS NO ACCOUNT NUMBER ==="
        );

        console.error(
          JSON.stringify(d, null, 2)
        );

        return NextResponse.json({
          ok: true,
        });
      }

      /*
      ---------------------------------------------------------
      FIND USER
      ---------------------------------------------------------

      We first try the Paystack customer code.

      If that isn't available, we fall back
      to the customer's email.
      ---------------------------------------------------------
      */

      const conditions: any[] = [];

      if (customerCode) {
        conditions.push({
          "kyc.customerCode":
            customerCode,
        });
      }

      if (email) {
        conditions.push({
          email,
        });
      }

      if (conditions.length === 0) {
        console.error(
          "=== DVA USER IDENTIFICATION FAILED ==="
        );

        console.error({
          email,
          customerCode,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      /*
      ---------------------------------------------------------
      UPDATE USER
      ---------------------------------------------------------
      */

      const updatedUser =
        await User.findOneAndUpdate(
          {
            $or: conditions,
          },
          {
            $set: {
              "kyc.accountNumber":
                accountNumber,

              "kyc.accountName":
                accountName,

              "kyc.bankName":
                bankName,

              "kyc.customerCode":
                customerCode,

              "kyc.dvaStatus":
                "ACTIVE",
            },
          },
          {
            new: true,
            runValidators: true,
          }
        ).lean();

      /*
      ---------------------------------------------------------
      LOG RESULT
      ---------------------------------------------------------
      */

      if (!updatedUser) {
        console.error(
          "=== DVA USER NOT FOUND ==="
        );

        console.error({
          email,
          customerCode,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      console.log(
        "=== DVA USER UPDATED SUCCESSFULLY ==="
      );

      console.log({
        userId:
          String(updatedUser._id),

        email:
          updatedUser.email,

        kycStatus:
          updatedUser.kyc?.status,

        kycType:
          updatedUser.kyc?.type,

        customerCode:
          updatedUser.kyc?.customerCode,

        accountNumber:
          updatedUser.kyc?.accountNumber,

        accountName:
          updatedUser.kyc?.accountName,

        bankName:
          updatedUser.kyc?.bankName,

        dvaStatus:
          updatedUser.kyc?.dvaStatus,
      });
    }


    /* =========================================================
       DEDICATED VIRTUAL ACCOUNT FAILED
       ========================================================= */

    if (
      e.event ===
      "dedicatedaccount.assign.failed"
    ) {
      const d = e.data || {};

      const customer =
        d.customer || {};

      const email = String(
        customer.email ||
          d.email ||
          ""
      )
        .trim()
        .toLowerCase();

      const customerCode =
        String(
          customer.customer_code ||
            d.customer_code ||
            ""
        ).trim();

      const reason = String(
        d.reason ||
          d.message ||
          "Dedicated account assignment failed"
      ).trim();

      console.error(
        "=== PAYSTACK DVA ASSIGNMENT FAILED ==="
      );

      console.error({
        email,
        customerCode,
        reason,
      });

      const conditions: any[] = [];

      if (customerCode) {
        conditions.push({
          "kyc.customerCode":
            customerCode,
        });
      }

      if (email) {
        conditions.push({
          email,
        });
      }

      if (conditions.length > 0) {
        await User.findOneAndUpdate(
          {
            $or: conditions,
          },
          {
            $set: {
              "kyc.dvaStatus":
                "FAILED",
            },
          },
          {
            runValidators: true,
          }
        );

        console.log(
          "=== DVA FAILURE SAVED ==="
        );
      }
    }


    /* =========================================================
       ACKNOWLEDGE PAYSTACK
       ========================================================= */

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error(
      "=== PAYSTACK WEBHOOK ERROR ==="
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Webhook processing failed",
      },
      {
        status: 500,
      }
    );
  }
}