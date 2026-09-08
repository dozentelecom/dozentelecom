import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";
import { smeapi, ProviderError } from "@/lib/smeapi";

import {
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

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

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
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
          error: "Transaction reference is required.",
        },
        { status: 400 }
      );
    }

    await db();

    /*
     * SECURITY
     *
     * A customer can only reconcile their own
     * transaction.
     */
    const tx: any = await Transaction.findOne({
      userId,
      externalReference: reference,
    });

    if (!tx) {
      return NextResponse.json(
        {
          error: "Transaction not found.",
        },
        { status: 404 }
      );
    }

    /*
     * FINAL LOCAL STATUS
     *
     * Never contact the provider again.
     */
    const localStatus = String(
      tx.status || ""
    ).toUpperCase();

    if (
      localStatus === "SUCCESS" ||
      localStatus === "FAILED" ||
      localStatus === "REVERSED"
    ) {
      return NextResponse.json({
        success: true,
        final: true,
        status: localStatus,
        reference: tx.externalReference,
      });
    }

    /*
     * Only SME transactions use the SME status
     * endpoint.
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
        status: localStatus || "PROCESSING",
        reference: tx.externalReference,
        message:
          "This transaction does not use SMEAPI status reconciliation.",
      });
    }

    let result: any;

    try {
      result = await smeapi.status({
        ref: tx.externalReference,
      });
    } catch (error: any) {
      /*
       * IMPORTANT:
       *
       * Provider timeout / outage is NOT a failure.
       *
       * Never refund merely because SME could not
       * be contacted.
       */
      if (error instanceof ProviderError) {
        return NextResponse.json(
          {
            success: false,
            final: false,
            status: localStatus || "PROCESSING",
            reference: tx.externalReference,
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
          status: localStatus || "PROCESSING",
          reference: tx.externalReference,
          message:
            "Transaction status could not be checked. It will remain processing.",
        },
        { status: 202 }
      );
    }

    const providerStatus = getStatus(result);

    /*
     * SUCCESS
     */
    if (isSuccess(result)) {
      /*
       * Re-read the transaction immediately before
       * completing it.
       *
       * Another polling request may have already
       * finalized it.
       */
      const latest: any =
        await Transaction.findOne({
          userId,
          externalReference: reference,
        });

      if (!latest) {
        return NextResponse.json(
          {
            error: "Transaction not found.",
          },
          { status: 404 }
        );
      }

      const latestStatus = String(
        latest.status || ""
      ).toUpperCase();

      if (
        latestStatus === "SUCCESS" ||
        latestStatus === "FAILED" ||
        latestStatus === "REVERSED"
      ) {
        return NextResponse.json({
          success: true,
          final: true,
          status: latestStatus,
          reference:
            latest.externalReference,
        });
      }

      const metadata =
        latest.metadata || {};

      /*
       * providerCost is stored in NAIRA in the
       * transaction metadata.
       */
      const providerCost = Number(
        metadata.providerCost ??
          metadata.providerAmount ??
          Number(latest.amountKobo || 0) /
            100
      );

      const costKobo =
        Number.isFinite(providerCost) &&
        providerCost >= 0
          ? Math.round(providerCost * 100)
          : Number(latest.amountKobo || 0);

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
            providerStatus || "success",
          reconciledAt:
            new Date().toISOString(),
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
      });
    }

    /*
     * FAILED / REVERSED
     *
     * failServiceTransaction()
     * refunds the full customer wallet debit.
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
            error: "Transaction not found.",
          },
          { status: 404 }
        );
      }

      const latestStatus = String(
        latest.status || ""
      ).toUpperCase();

      /*
       * Another polling request may already have
       * finalized this transaction.
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
              providerStatus || "failed",
            reconciledAt:
              new Date().toISOString(),
          },
        });

      return NextResponse.json({
        success: false,
        final: true,
        status: String(
          failedTx.status || "FAILED"
        ).toUpperCase(),
        reference:
          latest.externalReference,
        refunded: true,
        message: reason,
      });
    }

    /*
     * PROCESSING
     */
    if (isProcessing(result)) {
      return NextResponse.json({
        success: true,
        final: false,
        status: "PROCESSING",
        reference:
          tx.externalReference,
        message:
          "Transaction is still being processed.",
        providerStatus:
          providerStatus || "processing",
      });
    }

    /*
     * UNKNOWN RESPONSE
     *
     * Never guess.
     *
     * Do NOT refund.
     * Do NOT mark successful.
     */
    return NextResponse.json({
      success: true,
      final: false,
      status: localStatus || "PROCESSING",
      reference:
        tx.externalReference,
      message:
        "Transaction status is not yet final.",
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
      { status: 500 }
    );
  }
}