import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { requirePin } from "@/lib/authz";
import { getRates } from "@/lib/settings";
import { roundAirtime } from "@/lib/pricing";
import { smeapi, ProviderError } from "@/lib/smeapi";

import {
  assertServiceEnabled,
} from "@/lib/serviceControl";

import {
  startServiceTransaction,
  processServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

function makeReference() {
  return `AIRTIME-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`
    .toUpperCase();
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
    undefined
  );
}

function getProviderStatus(result: any) {
  return String(
    result?.status ??
      result?.data?.status ??
      ""
  ).toLowerCase();
}

function providerFailed(result: any) {
  const status = getProviderStatus(result);

  return (
    result?.success === false ||
    result?.status === false ||
    status === "failed" ||
    status === "failure" ||
    status === "error" ||
    status === "reversed" ||
    status === "cancelled"
  );
}

function providerPending(result: any) {
  const status = getProviderStatus(result);

  return (
    status === "pending" ||
    status === "processing" ||
    status === "queued" ||
    status === "in_progress"
  );
}

function isProviderUncertain(error: any) {
  if (!(error instanceof ProviderError)) {
    return false;
  }

  return (
    error.status >= 500 ||
    error.status === 408 ||
    error.status === 429 ||
    /timeout|timed out|network|fetch failed|connection/i.test(
      error.message || ""
    )
  );
}

export async function POST(req: Request) {
  let reference: string | null = null;

  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

await assertServiceEnabled("airtime");

    const body = await req.json();

    const network = Number(body.network);
    const phone = String(body.phone || "").trim();
    const input = Number(body.amount);

    if (
      !Number.isFinite(network) ||
      !/^[0-9]{11}$/.test(phone) ||
      !Number.isFinite(input) ||
      input <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Network, valid phone and amount are required.",
        },
        { status: 400 }
      );
    }

    /*
     * Transaction PIN
     */
    await requirePin(String(body.pin || ""));

    /*
     * Airtime currently has no normal airtime markup.
     *
     * We therefore keep the customer's purchase amount
     * equal to the rounded airtime amount.
     */
    const rates = await getRates();

    const roundUnit =
      Number(rates.airtimeRoundUnit || 10);

    const amount = roundAirtime(
      input,
      roundUnit
    );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid airtime amount." },
        { status: 400 }
      );
    }

    const customerKobo = Math.round(
      amount * 100
    );

    /*
     * Always generate the reference on the server.
     *
     * Do not trust a client-supplied reference because
     * transaction references must not be reusable.
     */
    reference = makeReference();

    /*
     * Create transaction + debit customer's wallet.
     *
     * amountKobo = actual amount customer pays.
     */
    await startServiceTransaction({
      userId,
      service: "airtime",
      amountKobo: customerKobo,
      reference,
      metadata: {
        network,
        phone,
        inputAmount: input,
        airtimeAmount: amount,
        roundUnit,
        provider: "SMEAPI",
      },
    });

    /*
     * Mark PROCESSING before contacting the provider.
     */
    await processServiceTransaction({
      reference,
      metadata: {
        providerStatus: "PROCESSING",
      },
    });

    let result: any;

    try {
      result = await smeapi.airtime({
        network,
        phone,
        amount,
        airtime_type: String(
          body.airtime_type || "VTU"
        ),
        ported_number: Boolean(
          body.ported_number
        ),
        ref: reference,
      });
    } catch (error: any) {
      /*
       * If the provider may have received the request,
       * DO NOT refund automatically.
       *
       * Leave transaction PROCESSING so the provider
       * status can be checked later.
       */
      if (isProviderUncertain(error)) {
        await processServiceTransaction({
          reference,
          metadata: {
            providerStatus: "UNKNOWN",
            providerError:
              error?.message ||
              "Provider response unavailable",
          },
        });

        return NextResponse.json(
          {
            success: false,
            pending: true,
            reference,
            message:
              "Your airtime request is being processed. Please check your transaction history for the final status.",
          },
          { status: 202 }
        );
      }

      /*
       * A definite provider rejection means the customer's
       * wallet must be refunded.
       */
      await failServiceTransaction({
        reference,
        reason:
          error?.message ||
          "Airtime purchase failed.",
        metadata: {
          providerError:
            error?.message ||
            String(error),
        },
      });

      const status =
        error instanceof ProviderError
          ? error.status || 400
          : 400;

      return NextResponse.json(
        {
          success: false,
          error:
            error?.message ||
            "Airtime purchase failed.",
          reference,
          refunded: true,
        },
        { status }
      );
    }

    /*
     * Provider explicitly rejected the purchase.
     */
    if (providerFailed(result)) {
      const reason =
        result?.message ||
        result?.error ||
        result?.provider_message ||
        "Airtime purchase failed.";

      await failServiceTransaction({
        reference,
        reason,
        metadata: {
          providerResponse: result,
          providerStatus:
            getProviderStatus(result),
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: reason,
          reference,
          refunded: true,
        },
        { status: 400 }
      );
    }

    /*
     * Provider accepted the request but says it is
     * still processing.
     */
    if (providerPending(result)) {
      await processServiceTransaction({
        reference,
        metadata: {
          providerResponse: result,
          providerStatus:
            getProviderStatus(result),
        },
      });

      return NextResponse.json(
        {
          success: true,
          pending: true,
          reference,
          message:
            "Airtime purchase is being processed.",
          pricing: {
            customerPrice: amount,
            providerAmount: amount,
            discount: 0,
            roundUnit,
          },
        },
        { status: 202 }
      );
    }

    /*
     * Successful provider response.
     *
     * Airtime currently has no separate provider cost
     * supplied by this route, so cost = customer amount
     * and profit = 0.
     */
    const providerReference =
      getProviderReference(result);

    await completeServiceTransaction({
      reference,
      costKobo: customerKobo,
      providerTransactionId:
        providerReference,
      metadata: {
        providerResponse: result,
        providerStatus:
          getProviderStatus(result) ||
          "SUCCESS",
      },
    });

    return NextResponse.json({
      success: true,
      pending: false,
      reference,
      pricing: {
        customerPrice: amount,
        providerAmount: amount,
        discount: 0,
        roundUnit,
      },
      providerReference:
        providerReference || null,
      result,
    });
  } catch (error: any) {
    console.error(
      "AIRTIME PURCHASE ERROR:",
      error
    );

    /*
     * Wallet errors happen before provider processing.
     * Do not attempt another refund here.
     */

	if (
  error?.message ===
  "SERVICE_DISABLED"
) {
  return NextResponse.json(
    {
      error:
        "Airtime service is temporarily unavailable.",
      reference,
    },
    { status: 403 }
  );
}

    if (
      error?.message ===
      "INSUFFICIENT_BALANCE"
    ) {
      return NextResponse.json(
        {
          error:
            "Insufficient wallet balance.",
          reference,
        },
        { status: 400 }
      );
    }

    if (
      error?.message ===
      "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to process airtime purchase.",
        reference,
      },
      { status: 400 }
    );
  }
}