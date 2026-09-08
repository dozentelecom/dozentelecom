import { NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/lib/db";
import {
  Funding,
  User,
  ProfitWithdrawal,
  Withdrawal,
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
        {
          error:
            "Webhook configuration error",
        },
        {
          status: 500,
        }
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
        {
          error: "Invalid signature",
        },
        {
          status: 401,
        }
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
        {
          error: "Invalid JSON",
        },
        {
          status: 400,
        }
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

    if (
      transferEvents.includes(e.event)
    ) {
      const data = e.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      if (reference) {
        /* =====================================================
           CUSTOMER WITHDRAWAL
           ===================================================== */

        const customerWithdrawal: any =
          await Withdrawal.findOne({
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

        if (customerWithdrawal) {
          console.log(
            "=== CUSTOMER WITHDRAWAL WEBHOOK ==="
          );

          console.log({
            reference,
            withdrawalReference:
              customerWithdrawal.reference,
            event: e.event,
            status:
              customerWithdrawal.status,
            userId:
              String(
                customerWithdrawal.userId
              ),
          });

          /* ===================================================
             SAVE PAYSTACK TRANSFER DATA
             =================================================== */

          customerWithdrawal.paystackData =
            data;

          if (data.transfer_code) {
            customerWithdrawal.paystackTransferCode =
              data.transfer_code;
          }

          /* ===================================================
             SUCCESS
             =================================================== */

          if (
            e.event ===
            "transfer.success"
          ) {
            /*
             * Never move a completed withdrawal
             * backwards.
             */

            if (
              customerWithdrawal.status !==
                "SUCCESS" &&
              customerWithdrawal.status !==
                "FAILED" &&
              customerWithdrawal.status !==
                "REVERSED"
            ) {
              customerWithdrawal.status =
                "SUCCESS";

              customerWithdrawal.completedAt =
                new Date();

              customerWithdrawal.error =
                undefined;

              await customerWithdrawal.save();

              console.log(
                "=== CUSTOMER WITHDRAWAL SUCCESS ==="
              );

              console.log({
                reference,
                amountKobo:
                  customerWithdrawal.amountKobo,
                payoutKobo:
                  customerWithdrawal.payoutKobo,
              });
            }
          }

          /* ===================================================
             FAILED / REVERSED
             =================================================== */

          if (
            e.event ===
              "transfer.failed" ||
            e.event ===
              "transfer.reversed"
          ) {
            const shouldRefund =
              customerWithdrawal.status ===
                "PENDING" ||
              customerWithdrawal.status ===
                "PROCESSING";

            /*
             * Only PENDING/PROCESSING withdrawals
             * are eligible for a refund.
             *
             * This prevents duplicate webhook events
             * from refunding the customer twice.
             */

            if (shouldRefund) {
              const refundReference =
                `withdrawal_refund_${customerWithdrawal.reference}`;

              try {
                /* =========================================
                   REFUND FULL AMOUNT
                   ========================================= */

                await creditWallet(
                  String(
                    customerWithdrawal.userId
                  ),
                  Number(
                    customerWithdrawal.amountKobo
                  ),
                  refundReference,
                  {
                    withdrawalId:
                      customerWithdrawal._id.toString(),

                    withdrawalReference:
                      customerWithdrawal.reference,

                    reason:
                      e.event ===
                      "transfer.reversed"
                        ? "Paystack withdrawal reversed"
                        : "Paystack withdrawal failed",

                    paystack:
                      data,
                  }
                );

                console.log(
                  "=== CUSTOMER WITHDRAWAL REFUNDED ==="
                );

                console.log({
                  reference,
                  refundKobo:
                    customerWithdrawal.amountKobo,
                });
              } catch (refundError: any) {
                /*
                 * If the refund ledger reference already
                 * exists, the refund has already happened.
                 *
                 * This protects against duplicate Paystack
                 * webhook deliveries.
                 */

                const message =
                  String(
                    refundError?.message ||
                      ""
                  );

                const duplicate =
                  message
                    .toLowerCase()
                    .includes(
                      "duplicate"
                    ) ||
                  message
                    .toLowerCase()
                    .includes(
                      "e11000"
                    );

                if (!duplicate) {
                  console.error(
                    "=== CUSTOMER WITHDRAWAL REFUND FAILED ==="
                  );

                  console.error(
                    refundError
                  );

                  /*
                   * Leave withdrawal as PROCESSING
                   * so Paystack can retry the webhook and
                   * the refund can be attempted again.
                   */

                  return NextResponse.json(
                    {
                      error:
                        "Withdrawal refund failed",
                    },
                    {
                      status: 500,
                    }
                  );
                }

                console.log(
                  "=== WITHDRAWAL REFUND ALREADY EXISTS ==="
                );
              }

              /* =========================================
                 MARK WITHDRAWAL FAILED / REVERSED
                 ========================================= */

              customerWithdrawal.status =
                e.event ===
                "transfer.reversed"
                  ? "REVERSED"
                  : "FAILED";

              customerWithdrawal.error =
                data.reason ||
                data.failures ||
                (
                  e.event ===
                  "transfer.reversed"
                    ? "Paystack transfer was reversed"
                    : "Paystack transfer failed"
                );

              customerWithdrawal.failedAt =
                new Date();

              if (
                e.event ===
                "transfer.reversed"
              ) {
                customerWithdrawal.reversedAt =
                  new Date();
              }

              await customerWithdrawal.save();

              console.log(
                "=== CUSTOMER WITHDRAWAL STATUS UPDATED ==="
              );

              console.log({
                reference,
                status:
                  customerWithdrawal.status,
              });
            } else {
              /*
               * Already terminal.
               * Do not refund again.
               */

              console.log(
                "=== CUSTOMER WITHDRAWAL ALREADY PROCESSED ==="
              );

              console.log({
                reference,
                status:
                  customerWithdrawal.status,
              });

              await customerWithdrawal.save();
            }
          }
        } else {
          /* ===================================================
             ADMIN / PROFIT WITHDRAWAL
             =================================================== */

          const profitWithdrawal: any =
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

          if (profitWithdrawal) {
            profitWithdrawal.paystackData =
              data;

            if (data.transfer_code) {
              profitWithdrawal.paystackTransferCode =
                data.transfer_code;
            }

            if (
              e.event ===
              "transfer.success"
            ) {
              profitWithdrawal.status =
                "SUCCESS";

              profitWithdrawal.completedAt =
                new Date();

              profitWithdrawal.error =
                undefined;
            }

            if (
              e.event ===
              "transfer.failed"
            ) {
              profitWithdrawal.status =
                "FAILED";

              profitWithdrawal.error =
                data.reason ||
                data.failures ||
                "Paystack transfer failed";
            }

            if (
              e.event ===
              "transfer.reversed"
            ) {
              profitWithdrawal.status =
                "REVERSED";

              profitWithdrawal.error =
                data.reason ||
                "Paystack transfer was reversed";
            }

            await profitWithdrawal.save();

            console.log(
              "=== PROFIT WITHDRAWAL UPDATED ==="
            );

            console.log({
              reference,
              status:
                profitWithdrawal.status,
            });
          } else {
            console.log(
              "=== TRANSFER REFERENCE NOT FOUND ==="
            );

            console.log({
              reference,
              event: e.event,
            });
          }
        }
      }
    }

    /* =========================================================
       WALLET FUNDING
       ========================================================= */

    if (
      e.event === "charge.success"
    ) {
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

      if (!accountNumber) {
        console.error(
          "=== DVA SUCCESS EVENT HAS NO ACCOUNT NUMBER ==="
        );

        return NextResponse.json({
          ok: true,
        });
      }

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

        return NextResponse.json({
          ok: true,
        });
      }

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
        ).lean() as any;

      if (!updatedUser) {
        console.error(
          "=== DVA USER NOT FOUND ==="
        );

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