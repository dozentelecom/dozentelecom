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

/*
 * ============================================================
 * STATUS HELPERS
 * ============================================================
 */

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

function isSuccess(result: any) {
  const status = getStatus(result);

  return (
    result?.success === true ||
    status === "success" ||
    status === "successful" ||
    status === "completed" ||
    status === "complete"
  );
}

function isFailed(result: any) {
  const status = getStatus(result);

  return (
    result?.success === false ||
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

/*
 * ============================================================
 * TWO-MINUTE RECONCILIATION WINDOW
 * ============================================================
 */

const RECONCILIATION_WINDOW_MS =
  2 * 60 * 1000;

function transactionAgeMs(tx: any) {
  if (!tx?.createdAt) {
    return 0;
  }

  const created =
    new Date(tx.createdAt).getTime();

  if (!Number.isFinite(created)) {
    return 0;
  }

  return Math.max(
    0,
    Date.now() - created
  );
}

function reconciliationDue(tx: any) {
  return (
    transactionAgeMs(tx) >=
    RECONCILIATION_WINDOW_MS
  );
}

/*
 * ============================================================
 * POST
 * ============================================================
 */

export async function POST(req: Request) {
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

    const body = await req.json();

    const reference = String(
      body?.reference ||
        body?.ref ||
        ""
    ).trim();

    if (!reference) {
      return NextResponse.json(
        {
          error:
            "Transaction reference is required.",
        },
        {
          status: 400,
        }
      );
    }

    await db();

    /*
     * ========================================================
     * SECURITY
     *
     * Customer can only reconcile their own
     * transaction.
     * ========================================================
     */

    const tx: any =
      await Transaction.findOne({
        userId,
        externalReference: reference,
      });

    if (!tx) {
      return NextResponse.json(
        {
          error: "Transaction not found.",
        },
        {
          status: 404,
        }
      );
    }

    const localStatus = String(
      tx.status || ""
    ).toUpperCase();

    const ageMs = transactionAgeMs(tx);
    const ageSeconds = Math.floor(
      ageMs / 1000
    );

    const due = reconciliationDue(tx);

    /*
     * ========================================================
     * FINAL LOCAL STATUS
     *
     * Never contact provider again.
     * ========================================================
     */

    if (
      localStatus === "SUCCESS" ||
      localStatus === "FAILED" ||
      localStatus === "REVERSED"
    ) {
      return NextResponse.json({
        success:
          localStatus === "SUCCESS",
        final: true,
        status: localStatus,
        reference: tx.externalReference,
        refunded:
          localStatus === "FAILED" ||
          localStatus === "REVERSED",
        ageSeconds,
        reconciliationDue: due,
      });
    }

    /*
     * ========================================================
     * ONLY SME SERVICES USE SME STATUS
     * ========================================================
     */

    const service = String(
      tx.service || ""
    ).toLowerCase();

    const smeServices = [
      "airtime",
      "data",
    ];

    if (!smeServices.includes(service)) {
      return NextResponse.json({
        success: true,
        final: false,
        status:
          localStatus || "PROCESSING",
        reference:
          tx.externalReference,
        ageSeconds,
        reconciliationDue: due,
        message:
          "This transaction does not use SMEAPI status reconciliation.",
      });
    }

    /*
     * ========================================================
     * PROVIDER STATUS CHECK
     * ========================================================
     */

    let result: any;

    try {
      result = await smeapi.status({
        ref: tx.externalReference,
      });
    } catch (error: any) {
      /*
       * Provider outage/timeout is NOT proof
       * that the transaction failed.
       *
       * Therefore:
       * - do not refund
       * - do not mark failed
       * - keep processing
       */

      if (error instanceof ProviderError) {
        return NextResponse.json(
          {
            success: false,
            final: false,
            status:
              localStatus ||
              "PROCESSING",
            reference:
              tx.externalReference,
            ageSeconds,
            reconciliationDue: due,
            message:
              "Transaction status could not be checked. It will remain processing.",
          },
          {
            status:
              error.status >= 500 ||
              error.status === 408 ||
              error.status === 429
                ? 202
                : error.status,
          }
        );
      }

      return NextResponse.json(
        {
          success: false,
          final: false,
          status:
            localStatus ||
            "PROCESSING",
          reference:
            tx.externalReference,
          ageSeconds,
          reconciliationDue: due,
          message:
            "Transaction status could not be checked. It will remain processing.",
        },
        {
          status: 202,
        }
      );
    }

    const providerStatus =
      getStatus(result);

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    if (isSuccess(result)) {
      /*
       * Re-read immediately before completion.
       *
       * Another polling request may already
       * have finalized the transaction.
       */

      const latest: any =
        await Transaction.findOne({
          userId,
          externalReference: reference,
        });

      if (!latest) {
        return NextResponse.json(
          {
            error:
              "Transaction not found.",
          },
          {
            status: 404,
          }
        );
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
        return NextResponse.json({
          success:
            latestStatus === "SUCCESS",
          final: true,
          status: latestStatus,
          reference:
            latest.externalReference,
        });
      }

      const metadata =
        latest.metadata || {};

      /*
       * providerCost is stored in NAIRA
       * in transaction metadata.
       */

      const providerCost = Number(
        metadata.providerCost ??
          metadata.providerAmount ??
          Number(
            latest.amountKobo || 0
          ) / 100
      );

      const costKobo =
        Number.isFinite(providerCost) &&
        providerCost >= 0
          ? Math.round(
              providerCost * 100
            )
          : Number(
              latest.amountKobo || 0
            );

      const providerReference =
        getProviderReference(result);

      await completeServiceTransaction({
        reference:
          latest.externalReference,

        costKobo,

        providerTransactionId:
          providerReference,

        metadata: {
          statusCheck: result,
          providerStatus:
            providerStatus ||
            "success",
          reconciledAt:
            new Date().toISOString(),
          reconciliationAgeSeconds:
            Math.floor(
              transactionAgeMs(
                latest
              ) / 1000
            ),
        },
      });

      return NextResponse.json({
        success: true,
        final: true,
        status: "SUCCESS",
        reference:
          latest.externalReference,
        providerReference:
          providerReference || null,
        refunded: false,
      });
    }

    /*
     * ========================================================
     * FAILED / REVERSED
     *
     * IMPORTANT:
     * We only refund after SMEAPI explicitly
     * confirms failure/reversal.
     *
     * This is what protects the wallet from a
     * false refund while the provider is still
     * processing.
     * ========================================================
     */

    if (isFailed(result)) {
      const latest: any =
        await Transaction.findOne({
          userId,
          externalReference: reference,
        });

      if (!latest) {
        return NextResponse.json(
          {
            error:
              "Transaction not found.",
          },
          {
            status: 404,
          }
        );
      }

      const latestStatus =
        String(
          latest.status || ""
        ).toUpperCase();

      /*
       * Another polling request may already
       * have finalized it.
       */

      if (
        latestStatus === "SUCCESS" ||
        latestStatus === "FAILED" ||
        latestStatus === "REVERSED"
      ) {
        return NextResponse.json({
          success:
            latestStatus === "SUCCESS",
          final: true,
          status: latestStatus,
          reference:
            latest.externalReference,
          refunded:
            latestStatus ===
              "FAILED" ||
            latestStatus ===
              "REVERSED",
        });
      }

      const reason =
        getProviderMessage(result);

      const failedTx =
        await failServiceTransaction({
          reference:
            latest.externalReference,

          reason,

          metadata: {
            statusCheck: result,
            providerStatus:
              providerStatus ||
              "failed",
            reconciledAt:
              new Date().toISOString(),
            reconciliationAgeSeconds:
              Math.floor(
                transactionAgeMs(
                  latest
                ) / 1000
              ),
          },
        });

      return NextResponse.json({
        success: false,
        final: true,
        status: String(
          failedTx.status ||
            "FAILED"
        ).toUpperCase(),
        reference:
          latest.externalReference,
        refunded: true,
        message: reason,
      });
    }

    /*
     * ========================================================
     * PROCESSING
     * ========================================================
     */

    if (isProcessing(result)) {
      /*
       * At 2 minutes we still DO NOT blindly refund.
       *
       * We have contacted SMEAPI and SMEAPI says
       * the transaction is still processing.
       *
       * Refunding here could cause:
       *
       * 1. Customer wallet refunded
       * 2. Provider later completes purchase
       * 3. Customer gets both value and money
       *
       * That creates a financial loss.
       *
       * We therefore continue reconciliation until
       * the provider gives a final state.
       */

      return NextResponse.json({
        success: true,
        final: false,
        status: "PROCESSING",
        reference:
          tx.externalReference,
        ageSeconds,
        reconciliationDue: due,
        message: due
          ? "Transaction has reached the 2-minute reconciliation window but the provider still reports it as processing. It will remain pending until a final provider status is received."
          : "Transaction is still being processed.",
        providerStatus:
          providerStatus ||
          "processing",
      });
    }

    /*
     * ========================================================
     * UNKNOWN PROVIDER RESPONSE
     *
     * Never guess.
     *
     * Do not:
     * - refund
     * - mark successful
     * ========================================================
     */

    return NextResponse.json({
      success: true,
      final: false,
      status:
        localStatus ||
        "PROCESSING",
      reference:
        tx.externalReference,
      ageSeconds,
      reconciliationDue: due,
      message: due
        ? "The transaction has reached the reconciliation window, but the provider returned an unknown status. No refund has been issued because the transaction outcome cannot safely be determined."
        : "Transaction status is not yet final.",
      providerStatus:
        providerStatus || null,
    });
  } catch (error: any) {
    console.error(
      "TRANSACTION STATUS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to check transaction status.",
      },
      {
        status: 500,
      }
    );
  }
}