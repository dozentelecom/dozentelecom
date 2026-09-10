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
  console.log("=== PAYSTACK WEBHOOK GET TEST ===");

  return NextResponse.json({
    ok: true,
    message: "Paystack webhook route is live",
  });
}

/* =========================================================
   POST — PAYSTACK WEBHOOK
   ========================================================= */

export async function POST(req: Request) {
  console.log("=== PAYSTACK WEBHOOK POST RECEIVED ===");

  try {
    /* =======================================================
       READ RAW BODY
       IMPORTANT:
       Paystack signature must be calculated from the
       exact raw request body.
       ======================================================= */

    const raw = await req.text();

    const signature =
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

    /* =======================================================
       VERIFY PAYSTACK SIGNATURE
       ======================================================= */

    const expectedSignature =
      crypto
        .createHmac("sha512", secret)
        .update(raw)
        .digest("hex");

    const isValidSignature =
      signature.length ===
        expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, "utf8"),
        Buffer.from(
          expectedSignature,
          "utf8"
        )
      );

    if (!isValidSignature) {
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

    /* =======================================================
       PARSE EVENT
       ======================================================= */

    let event: any;

    try {
      event = JSON.parse(raw);
    } catch {
      console.error(
        "=== PAYSTACK WEBHOOK INVALID JSON ==="
      );

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
      JSON.stringify(event, null, 2)
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
      transferEvents.includes(event.event)
    ) {
      const data = event.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      if (!reference) {
        console.error(
          "=== TRANSFER EVENT WITHOUT REFERENCE ==="
        );

        return NextResponse.json({
          ok: true,
        });
      }

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
          event: event.event,
          currentStatus:
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
           TRANSFER SUCCESS
           =================================================== */

        if (
          event.event ===
          "transfer.success"
        ) {
          /*
           * SUCCESS is terminal.
           *
           * FAILED and REVERSED are also terminal.
           * Never allow a late success webhook to
           * change a withdrawal that has already been
           * refunded.
           */

          if (
            customerWithdrawal.status ===
              "PENDING" ||
            customerWithdrawal.status ===
              "PROCESSING"
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
          } else {
            console.log(
              "=== CUSTOMER WITHDRAWAL SUCCESS EVENT ALREADY PROCESSED ==="
            );

            console.log({
              reference,
              currentStatus:
                customerWithdrawal.status,
            });

            await customerWithdrawal.save();
          }
        }

        /* ===================================================
           TRANSFER FAILED / REVERSED
           =================================================== */

        if (
          event.event ===
            "transfer.failed" ||
          event.event ===
            "transfer.reversed"
        ) {
          /*
           * Only PENDING or PROCESSING withdrawals
           * can be refunded.
           *
           * This prevents duplicate refunds when
           * Paystack retries the same webhook.
           */

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
                 REFUND FULL CUSTOMER DEBIT
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
                    event.event ===
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
              const message = String(
                refundError?.message || ""
              );

              const duplicate =
                message
                  .toLowerCase()
                  .includes("duplicate") ||
                message
                  .toLowerCase()
                  .includes("e11000");

              if (!duplicate) {
                console.error(
                  "=== CUSTOMER WITHDRAWAL REFUND FAILED ==="
                );

                console.error(
                  refundError
                );

                /*
                 * Do NOT mark the withdrawal as
                 * FAILED/REVERSED if the wallet
                 * refund itself failed.
                 *
                 * The customer is still owed
                 * the money.
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
               MARK WITHDRAWAL TERMINAL
               ========================================= */

            customerWithdrawal.status =
              event.event ===
              "transfer.reversed"
                ? "REVERSED"
                : "FAILED";

            customerWithdrawal.error =
              String(
                data.reason ||
                  data.failures ||
                  (
                    event.event ===
                    "transfer.reversed"
                      ? "Paystack transfer was reversed"
                      : "Paystack transfer failed"
                  )
              );

            customerWithdrawal.failedAt =
              new Date();

            if (
              event.event ===
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

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         ADMIN / PROFIT WITHDRAWAL
         ===================================================== */

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

        /* ===================================================
           PROFIT TRANSFER SUCCESS
           =================================================== */

        if (
          event.event ===
          "transfer.success"
        ) {
          /*
           * Do not move a terminal state backwards.
           */

          if (
            profitWithdrawal.status !==
              "SUCCESS" &&
            profitWithdrawal.status !==
              "FAILED" &&
            profitWithdrawal.status !==
              "REVERSED"
          ) {
            profitWithdrawal.status =
              "SUCCESS";

            profitWithdrawal.completedAt =
              new Date();

            profitWithdrawal.error =
              undefined;
          }
        }

        /* ===================================================
           PROFIT TRANSFER FAILED
           =================================================== */

        if (
          event.event ===
          "transfer.failed"
        ) {
          if (
            profitWithdrawal.status !==
              "SUCCESS" &&
            profitWithdrawal.status !==
              "FAILED" &&
            profitWithdrawal.status !==
              "REVERSED"
          ) {
            profitWithdrawal.status =
              "FAILED";

            profitWithdrawal.error =
              String(
                data.reason ||
                  data.failures ||
                  "Paystack transfer failed"
              );
          }
        }

        /* ===================================================
           PROFIT TRANSFER REVERSED
           =================================================== */

        if (
          event.event ===
          "transfer.reversed"
        ) {
          if (
            profitWithdrawal.status !==
              "SUCCESS" &&
            profitWithdrawal.status !==
              "FAILED" &&
            profitWithdrawal.status !==
              "REVERSED"
          ) {
            profitWithdrawal.status =
              "REVERSED";

            profitWithdrawal.error =
              String(
                data.reason ||
                  "Paystack transfer was reversed"
              );
          }
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

        return NextResponse.json({
          ok: true,
        });
      }

      console.log(
        "=== TRANSFER REFERENCE NOT FOUND ==="
      );

      console.log({
        reference,
        event: event.event,
      });

      return NextResponse.json({
        ok: true,
      });
    }

    /* =========================================================
       WALLET FUNDING / DIRECT DVA FUNDING
       ========================================================= */

    if (
      event.event ===
      "charge.success"
    ) {
      const data = event.data || {};

      const reference = String(
        data.reference || ""
      ).trim();

      const amountKobo = Number(
        data.amount || 0
      );

     const channel = String(
  data.authorization?.channel ||
  data.channel ||
  ""
).trim().toLowerCase();

      /* =====================================================
         CUSTOMER INFORMATION
         ===================================================== */

      const receiverAccountNumber =
        String(
          data.authorization
            ?.receiver_bank_account_number ||
            data.metadata
              ?.receiver_account_number ||
            data.receiver_bank_account_number ||
            data.dedicated_account
              ?.account_number ||
            ""
        ).trim();

      const receiverBank =
        String(
          data.authorization
            ?.receiver_bank ||
            data.metadata?.receiver_bank ||
            data.receiver_bank ||
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
          data.customer?.customer_code ||
            data.customer_code ||
            ""
        ).trim();

      /*
       * IMPORTANT:
       *
       * Only a Paystack dedicated_nuban charge is
       * automatically treated as DVA funding.
       *
       * We do NOT classify every charge containing
       * a receiver account number as DVA.
       */

      const isDvaCharge =
        channel ===
        "dedicated_nuban";

      console.log(
        "=== PAYSTACK CHARGE SUCCESS ==="
      );

      console.log({
        reference,
        amountKobo,
        amountNaira:
          amountKobo / 100,
        channel,
        currency:
          data.currency || null,
        receiverAccountNumber:
          receiverAccountNumber ||
          null,
        receiverBank:
          receiverBank || null,
        customerEmail:
          customerEmail || null,
        customerCode:
          customerCode || null,
        isDvaCharge,
      });

      /* =====================================================
         BASIC VALIDATION
         ===================================================== */

      if (
        !reference ||
        !Number.isInteger(
          amountKobo
        ) ||
        amountKobo <= 0
      ) {
        console.error(
          "=== INVALID CHARGE.SUCCESS DATA ==="
        );

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         1. DIRECT DVA FUNDING
         ===================================================== */

      if (isDvaCharge) {
        console.log(
          "=== DIRECT DVA FUNDING ==="
        );

        let user: any = null;

        /*
         * Strongest identifier:
         * dedicated virtual account number.
         */

        if (
          receiverAccountNumber
        ) {
          const accountConditions: any[] =
            [
              {
                "kyc.accountNumber":
                  receiverAccountNumber,
              },
            ];

          if (
            /^\d+$/.test(
              receiverAccountNumber
            )
          ) {
            accountConditions.push({
              "kyc.accountNumber":
                Number(
                  receiverAccountNumber
                ),
            });
          }

          user =
            await User.findOne({
              $or:
                accountConditions,
            });
        }

        /*
         * Fallback:
         * Paystack customer code.
         */

        if (
          !user &&
          customerCode
        ) {
          user =
            await User.findOne({
              "kyc.customerCode":
                customerCode,
            });
        }

        /*
         * Final fallback:
         * customer email.
         */

        if (
          !user &&
          customerEmail
        ) {
          const escapedEmail =
            customerEmail.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          user =
            await User.findOne({
              email: {
                $regex:
                  `^${escapedEmail}$`,
                $options: "i",
              },
            });
        }

        if (!user) {
          console.error(
            "=== DVA USER NOT FOUND ==="
          );

          console.error({
            receiverAccountNumber,
            customerEmail,
            customerCode,
            reference,
          });

          /*
           * Return 200 so Paystack does not endlessly
           * retry an event that cannot currently be
           * associated with a customer.
           *
           * Investigate this transaction manually.
           */

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

        /* =================================================
           IDEMPOTENCY
           ================================================= */

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

          return NextResponse.json({
            ok: true,
          });
        }

        /* =================================================
           CREDIT CUSTOMER WALLET
           ================================================= */

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

            receiverBank,

            customerEmail,

            customerCode,

            paystack:
              data,
          }
        );

        console.log(
          "=== DVA WALLET CREDITED SUCCESSFULLY ==="
        );

        console.log({
          userId:
            String(user._id),
          reference,
          amountKobo,
          amountNaira:
            amountKobo / 100,
          ledgerReference:
            dvaReference,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         2. NORMAL WALLET FUNDING
         ===================================================== */

      console.log(
        "=== NORMAL PAYSTACK FUNDING ==="
      );

      const funding: any =
        await Funding.findOne({
          reference,
        });

      if (!funding) {
        console.error(
          "=== FUNDING RECORD NOT FOUND ==="
        );

        console.error({
          reference,
          amountKobo,
        });

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         IDEMPOTENCY
         ===================================================== */

      if (
        funding.status ===
        "CREDITED"
      ) {
        console.log(
          "=== NORMAL FUNDING ALREADY CREDITED ==="
        );

        funding.providerData =
          data;

        funding.paystackReference =
          reference;

        await funding.save();

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         VERIFY PAYMENT AMOUNT
         ===================================================== */

      if (
        amountKobo !==
        Number(
          funding.grossKobo
        )
      ) {
        console.error(
          "=== FUNDING AMOUNT MISMATCH ==="
        );

        console.error({
          reference,
          webhookAmountKobo:
            amountKobo,
          fundingGrossKobo:
            funding.grossKobo,
        });

        /*
         * NEVER credit a mismatched payment.
         */

        funding.providerData =
          data;

        funding.paystackReference =
          reference;

        await funding.save();

        return NextResponse.json({
          ok: true,
        });
      }

      /* =====================================================
         CREDIT WALLET
         ===================================================== */

      await creditWallet(
        String(funding.userId),
        Number(
          funding.creditKobo
        ),
        `FUND-${funding.reference}`,
        {
          source:
            "PAYSTACK_FUNDING",

          paystack:
            data,

          feeKobo:
            Number(
              funding.feeKobo || 0
            ),
        }
      );

      funding.status =
        "CREDITED";

      funding.providerData =
        data;

      funding.paystackReference =
        reference;

      await funding.save();

      console.log(
        "=== NORMAL FUNDING WALLET CREDITED ==="
      );

      console.log({
        userId:
          String(funding.userId),
        reference:
          funding.reference,
        grossKobo:
          funding.grossKobo,
        creditKobo:
          funding.creditKobo,
        feeKobo:
          funding.feeKobo,
      });

      return NextResponse.json({
        ok: true,
      });
    }

    /* =========================================================
       DVA ASSIGNMENT SUCCESS
       ========================================================= */

    if (
      event.event ===
      "dedicatedaccount.assign.success"
    ) {
      const data =
        event.data || {};

      const customer =
        data.customer || {};

      const email =
        String(
          customer.email ||
            data.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const customerCode =
        String(
          customer.customer_code ||
            data.customer_code ||
            ""
        ).trim();

      const accountNumber =
        String(
          data.account_number ||
            data.account
              ?.account_number ||
            data.dedicated_account
              ?.account_number ||
            ""
        ).trim();

      const accountName =
        String(
          data.account_name ||
            data.account
              ?.account_name ||
            data.account?.name ||
            data.dedicated_account
              ?.account_name ||
            ""
        ).trim();

      const bankName =
        String(
          data.bank?.name ||
            data.account?.bank?.name ||
            data.dedicated_account
              ?.bank?.name ||
            data.bank_name ||
            data.bankName ||
            ""
        ).trim();

      console.log(
        "=== DVA ASSIGNMENT SUCCESS ==="
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

      const conditions: any[] =
        [];

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
          String(
            updatedUser._id
          ),
        email:
          updatedUser.email,
        customerCode:
          updatedUser.kyc
            ?.customerCode,
        accountNumber:
          updatedUser.kyc
            ?.accountNumber,
        accountName:
          updatedUser.kyc
            ?.accountName,
        bankName:
          updatedUser.kyc?.bankName,
        dvaStatus:
          updatedUser.kyc
            ?.dvaStatus,
      });

      return NextResponse.json({
        ok: true,
      });
    }

    /* =========================================================
       DVA ASSIGNMENT FAILED
       ========================================================= */

    if (
      event.event ===
      "dedicatedaccount.assign.failed"
    ) {
      const data =
        event.data || {};

      const customer =
        data.customer || {};

      const email =
        String(
          customer.email ||
            data.email ||
            ""
        )
          .trim()
          .toLowerCase();

      const customerCode =
        String(
          customer.customer_code ||
            data.customer_code ||
            ""
        ).trim();

      const reason =
        String(
          data.reason ||
            data.message ||
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

      const conditions: any[] =
        [];

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

      return NextResponse.json({
        ok: true,
      });
    }

    /* =========================================================
       UNKNOWN / OTHER PAYSTACK EVENTS
       ========================================================= */

    console.log(
      "=== PAYSTACK EVENT ACKNOWLEDGED ==="
    );

    console.log({
      event:
        event.event,
    });

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