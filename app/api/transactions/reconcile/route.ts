import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";
import {
  smeapi,
  ProviderError,
} from "@/lib/smeapi";

import {
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

/* =========================================================
STATUS HELPERS
========================================================= */

function getStatus(result: any) {
  return String(
    result?.status ??
      result?.data?.status ??
      result?.data?.transaction?.status ??
      ""
  ).toLowerCase();
}

function getProviderReference(result: any) {
  return (
    result?.reference ||
    result?.ref ||
    result?.transaction_id ||
    result?.transactionId ||
    result?.data?.reference ||
    result?.data?.ref ||
    result?.data?.transaction_id ||
    result?.data?.transactionId ||
    result?.data?.transaction?.reference ||
    result?.data?.transaction?.transaction_id ||
    undefined
  );
}

function getProviderMessage(result: any) {
  return (
    result?.message ||
    result?.error ||
    result?.provider_message ||
    result?.data?.message ||
    result?.data?.error ||
    result?.data?.provider_message ||
    "Transaction failed."
  );
}

/*
 * IMPORTANT:
 *
 * We only treat explicit final provider statuses
 * as SUCCESS or FAILED.
 *
 * This prevents an API response such as:
 *
 * {
 *   success: true,
 *   status: "pending"
 * }
 *
 * from accidentally becoming SUCCESS.
 */

function isSuccess(result: any) {
  const status = getStatus(result);

  return (
    status === "success" ||
    status === "successful" ||
    status === "completed" ||
    status === "complete"
  );
}

function isFailed(result: any) {
  const status = getStatus(result);

  return (
    status === "failed" ||
    status === "failure" ||
    status === "error" ||
    status === "reversed" ||
    status === "cancelled"
  );
}

function isProcessing(result: any) {
  const status = getStatus(result);

  return (
    status === "processing" ||
    status === "pending" ||
    status === "queued" ||
    status === "in_progress" ||
    status === "in-progress" ||
    status === "initiated"
  );
}

/* =========================================================
POST
========================================================= */

export async function POST() {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    await db();

    /*
     * =======================================================
     * FIND ALL OLD PROCESSING SERVICE TRANSACTIONS
     * =======================================================
     */

    const transactions: any[] =
      await Transaction.find({
        userId,
        service: {
          $in: [
            "airtime",
            "data",
          ],
        },
        status: {
          $in: [
            "PROCESSING",
            "PENDING",
          ],
        },
      })
        .sort({
          createdAt: 1,
        })
        .limit(50)
        .lean();

    /*
     * Nothing waiting for reconciliation.
     */

    if (!transactions.length) {
      return NextResponse.json({
        success: true,
        checked: 0,
        updated: 0,
        processing: 0,
        results: [],
      });
    }

    const results: any[] = [];

    let updated = 0;
    let processing = 0;

    /*
     * =======================================================
     * CHECK EVERY OLD TRANSACTION
     * =======================================================
     */

    for (const tx of transactions) {
      const reference = String(
        tx.externalReference || ""
      ).trim();

      if (!reference) {
        results.push({
          reference: "",
          status: "PROCESSING",
          checked: false,
          message:
            "Transaction has no external reference.",
        });

        processing++;

        continue;
      }

      try {
        /*
         * Ask SMEAPI for the current provider status.
         */

        const providerResult =
          await smeapi.status({
            ref: reference,
          });

        const providerStatus =
          getStatus(providerResult);

        /*
         * ===================================================
         * SUCCESS
         * ===================================================
         */

        if (isSuccess(providerResult)) {
          /*
           * Re-read transaction so we don't overwrite
           * a transaction that may have been completed
           * by another request while this check was running.
           */

          const latest: any =
            await Transaction.findOne({
              userId,
              externalReference:
                reference,
            });

          if (!latest) {
            continue;
          }

          const latestStatus =
            String(
              latest.status || ""
            ).toUpperCase();

          if (
            latestStatus === "SUCCESS" ||
            latestStatus === "FAILED" ||
            latestStatus === "REVERSED"
          ) {
            results.push({
              reference,
              status: latestStatus,
              checked: true,
              updated: false,
            });

            continue;
          }

          const metadata =
            latest.metadata || {};

          /*
           * Use the provider cost already stored
           * on the transaction where available.
           */

          const providerCost = Number(
            metadata.providerCost ??
              metadata.providerAmount ??
              Number(
                latest.amountKobo || 0
              ) / 100
          );

          const costKobo =
            Number.isFinite(
              providerCost
            ) &&
            providerCost >= 0
              ? Math.round(
                  providerCost * 100
                )
              : Number(
                  latest.amountKobo || 0
                );

          const providerReference =
            getProviderReference(
              providerResult
            );

          await completeServiceTransaction({
            reference,
            costKobo,
            providerTransactionId:
              providerReference,
            metadata: {
              statusCheck:
                providerResult,

              providerStatus:
                providerStatus ||
                "success",

              reconciledAt:
                new Date().toISOString(),

              reconciliationSource:
                "BACKGROUND_RECONCILIATION",
            },
          });

          updated++;

          results.push({
            reference,
            status: "SUCCESS",
            checked: true,
            updated: true,
            providerReference:
              providerReference || null,
          });

          continue;
        }

        /*
         * ===================================================
         * FAILED
         * ===================================================
         */

        if (isFailed(providerResult)) {
          const latest: any =
            await Transaction.findOne({
              userId,
              externalReference:
                reference,
            });

          if (!latest) {
            continue;
          }

          const latestStatus =
            String(
              latest.status || ""
            ).toUpperCase();

          if (
            latestStatus === "SUCCESS" ||
            latestStatus === "FAILED" ||
            latestStatus === "REVERSED"
          ) {
            results.push({
              reference,
              status: latestStatus,
              checked: true,
              updated: false,
            });

            continue;
          }

          const reason =
            getProviderMessage(
              providerResult
            );

          const failedTx =
            await failServiceTransaction({
              reference,
              reason,
              metadata: {
                statusCheck:
                  providerResult,

                providerStatus:
                  providerStatus ||
                  "failed",

                reconciledAt:
                  new Date().toISOString(),

                reconciliationSource:
                  "BACKGROUND_RECONCILIATION",
              },
            });

          updated++;

          results.push({
            reference,
            status: String(
              failedTx.status ||
                "FAILED"
            ).toUpperCase(),
            checked: true,
            updated: true,
            refunded: true,
            message: reason,
          });

          continue;
        }

        /*
         * ===================================================
         * STILL PROCESSING
         * ===================================================
         */

        if (isProcessing(providerResult)) {
          processing++;

          results.push({
            reference,
            status: "PROCESSING",
            checked: true,
            updated: false,
            providerStatus:
              providerStatus ||
              "processing",
          });

          continue;
        }

        /*
         * ===================================================
         * UNKNOWN PROVIDER STATUS
         * ===================================================
         *
         * Do NOT refund.
         * Do NOT mark success.
         * Do NOT mark failed.
         */

        processing++;

        results.push({
          reference,
          status: "PROCESSING",
          checked: true,
          updated: false,
          providerStatus:
            providerStatus ||
            null,
          message:
            "Provider returned an unknown status. Transaction remains processing.",
        });
      } catch (error: any) {
        /*
         * Provider temporarily unavailable.
         *
         * Leave transaction untouched.
         */

        processing++;

        if (error instanceof ProviderError) {
          results.push({
            reference,
            status: "PROCESSING",
            checked: false,
            updated: false,
            message:
              "Provider status could not be checked.",
          });
        } else {
          results.push({
            reference,
            status: "PROCESSING",
            checked: false,
            updated: false,
            message:
              "Transaction status could not be checked.",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      checked: transactions.length,
      updated,
      processing,
      results,
    });
  } catch (error: any) {
    console.error(
      "TRANSACTION RECONCILIATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to reconcile transactions.",
      },
      {
        status: 500,
      }
    );
  }
}
