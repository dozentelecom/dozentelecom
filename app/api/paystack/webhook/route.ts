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
          error: "Webhook configuration error",
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
       WALLET FUNDING / DIRECT DVA FUNDING
       ========================================================= */

    if (e.event === "charge.success") {
      const data = e.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      const amountKobo = Number(
        data.amount || 0
      );

      console.log(
        "=== PAYSTACK CHARGE SUCCESS ==="
      );

      console.log({
        reference,
        amountKobo,
        channel:
          data.channel || null,
        currency:
          data.currency || null,
        customerEmail:
          data.customer?.email ||
          data.email ||
          null,
        customerCode:
          data.customer?.customer_code ||
          data.customer_code ||
          null,
        receiverAccount:
          data.authorization
            ?.receiver_bank_account_number ||
          data.receiver_bank_account_number ||
          data.dedicated_account
            ?.account_number ||
          null,
      });

      if (
        !reference ||
        amountKobo <= 0
      ) {
        console.error(
          "=== INVALID CHARGE.SUCCESS DATA ==="
        );

        return NextResponse.json({
          ok: true,
        });
      }

      /* =======================================================
         1. CHECK NORMAL FUNDING RECORD
         ======================================================= */

      const f: any =
        await Funding.findOne({
          reference,
        });

      if (f) {
        console.log(
          "=== EXISTING FUNDING RECORD FOUND ==="
        );

        /*
         * Verify the amount before crediting.
         */

        if (
          f.status !== "CREDITED" &&
          amountKobo ===
            Number(f.grossKobo)
        ) {
          await creditWallet(
            String(f.userId),
            Number(f.creditKobo),
            `FUND-${f.reference}`,
            {
              source:
                "PAYSTACK_FUNDING",

              paystack: data,

              feeKobo:
                f.feeKobo,
            }
          );

          f.status = "CREDITED";

          f.providerData =
            data;

          await f.save();

          console.log(
            "=== NORMAL FUNDING WALLET CREDITED ==="
          );

          console.log({
            userId:
              String(f.userId),

            reference:
              f.reference,

            grossKobo:
              f.grossKobo,

            creditKobo:
              f.creditKobo,
          });
        } else if (
          f.status !== "CREDITED"
        ) {
          console.error(
            "=== FUNDING AMOUNT MISMATCH ==="
          );

          console.error({
            reference,
            webhookAmountKobo:
              amountKobo,
            fundingGrossKobo:
              f.grossKobo,
          });
        }

        return NextResponse.json({
          ok: true,
        });
      }

      /* =======================================================
         2. DIRECT DVA FUNDING
         ======================================================= */

      console.log(
        "=== NO FUNDING RECORD FOUND ==="
      );

      console.log(
        "=== CHECKING DIRECT DVA FUNDING ==="
      );

      /*
       * Paystack can identify the receiving
       * dedicated account through the
       * authorization object.
       */

      const receiverAccountNumber =
        String(
          data.authorization
            ?.receiver_bank_account_number ||
            data.receiver_bank_account_number ||
            data.dedicated_account
              ?.account_number ||
            ""
        ).trim();

      const customerEmail =
        String(
          data.customer?.email ||
            data.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const customerCode =
        String(
          data.customer
            ?.customer_code ||
            data.customer_code ||
            ""
        ).trim();

      console.log(
        "=== DVA IDENTIFICATION DATA ==="
      );

      console.log({
        receiverAccountNumber,
        customerEmail,
        customerCode,
      });

      /* =======================================================
         FIND USER
         ======================================================= */

      const conditions: any[] = [];

      /*
       * BEST MATCH:
       * Dedicated virtual account number.
       */

      if (
        receiverAccountNumber
      ) {
        conditions.push({
          "kyc.accountNumber":
            receiverAccountNumber,
        });
      }

      /*
       * SECOND MATCH:
       * Paystack customer code.
       */

      if (customerCode) {
        conditions.push({
          "kyc.customerCode":
            customerCode,
        });
      }

      /*
       * THIRD MATCH:
       * Customer email.
       */

      if (customerEmail) {
        conditions.push({
          email:
            customerEmail,
        });
      }

      if (
        conditions.length === 0
      ) {
        console.error(
          "=== DVA USER IDENTIFICATION FAILED ==="
        );

        console.error(
          "Paystack charge.success did not contain enough customer/account information."
        );

        return NextResponse.json({
          ok: true,
        });
      }

      const user: any =
        await User.findOne({
          $or: conditions,
        }).lean();

      if (!user) {
        console.error(
          "=== DVA USER NOT FOUND ==="
        );

        console.error({
          receiverAccountNumber,
          customerEmail,
          customerCode,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      console.log(
        "=== DVA USER FOUND ==="
      );

      console.log({
        userId:
          String(user._id),

        email:
          user.email,

        accountNumber:
          user.kyc?.accountNumber,

        customerCode:
          user.kyc?.customerCode,
      });

      /* =======================================================
         IDEMPOTENCY CHECK
         ======================================================= */

      const dvaReference =
        `DVA-${reference}`;

      const existingLedger =
        await Ledger.findOne({
          reference:
            dvaReference,
        });

      if (existingLedger) {
        console.log(
          "=== DVA PAYMENT ALREADY CREDITED ==="
        );

        console.log({
          userId:
            String(user._id),

          paystackReference:
            reference,

          ledgerReference:
            dvaReference,

          amountKobo,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      /* =======================================================
         CREDIT CUSTOMER WALLET
         ======================================================= */

      await creditWallet(
        String(user._id),
        amountKobo,
        dvaReference,
        {
          source:
            "PAYSTACK_DEDICATED_VIRTUAL_ACCOUNT",

          paystackReference:
            reference,

          receiverAccountNumber,

          customerEmail,

          customerCode,

          paystack:
            data,
        }
      );

      console.log(
        "========================================"
      );

      console.log(
        "=== DVA WALLET CREDITED SUCCESSFULLY ==="
      );

      console.log({
        userId:
          String(user._id),

        email:
          user.email,

        accountNumber:
          user.kyc?.accountNumber,

        reference,

        amountKobo,

        amountNaira:
          amountKobo / 100,
      });

      console.log(
        "========================================"
      );
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

      if (
        conditions.length === 0
      ) {
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

      if (
        conditions.length > 0
      ) {
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