import { NextResponse } from "next/server";
import {
  smeapi,
  ProviderError,
} from "@/lib/smeapi";
import { requirePin } from "@/lib/authz";
import { currentUserId } from "@/lib/session";
import { getRates } from "@/lib/settings";
import { percentPrice } from "@/lib/pricing";

import {
  startServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

function getPlans(result: any) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.plans)) {
    return result.plans;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.data?.plans)) {
    return result.data.plans;
  }

  return [];
}

function getPlanId(plan: any) {
  return String(
    plan?.id ??
      plan?.plan_id ??
      plan?.data_plan ??
      ""
  );
}

function getPlanNetwork(plan: any) {
  return String(
    plan?.network_id ??
      plan?.network ??
      ""
  );
}

function getPlanCost(plan: any) {
  return Number(
    plan?.price ??
      plan?.amount ??
      plan?.selling_price ??
      plan?.cost ??
      0
  );
}

function providerFailed(result: any) {
  const values = [
    result?.success,
    result?.status,
    result?.data?.success,
    result?.data?.status,
  ];

  return values.some(
    (v) =>
      v === false ||
      ["failed", "error", "reversed"].includes(
        String(v).toLowerCase()
      )
  );
}

function providerReference(result: any) {
  return (
    result?.data?.reference ||
    result?.reference ||
    result?.data?.transaction_reference ||
    result?.transaction_reference ||
    result?.data?.id ||
    result?.id
  );
}

export async function POST(req: Request) {
  let reference = "";

  try {
    const b = await req.json();

    await requirePin(String(b.pin || ""));

    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const network = Number(b.network);
    const data_plan = Number(b.data_plan);
    const phone = String(b.phone || "");

    if (
      !Number.isFinite(network) ||
      !Number.isFinite(data_plan) ||
      !/^[0-9]{11}$/.test(phone)
    ) {
      return NextResponse.json(
        {
          error:
            "network, data_plan and a valid 11-digit phone are required",
        },
        { status: 400 }
      );
    }

    /*
     * NEVER trust the price sent by the browser.
     * Fetch the current provider plan and calculate
     * the customer price on the server.
     */

    const rawPlans =
      await smeapi.dataPlans();

    const plans = getPlans(rawPlans);

    const plan = plans.find((p: any) => {
      const idMatches =
        getPlanId(p) === String(data_plan);

      const networkValue =
        getPlanNetwork(p);

      const networkMatches =
        !networkValue ||
        networkValue === String(network);

      return (
        idMatches &&
        networkMatches
      );
    });

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "Selected data plan could not be found",
        },
        { status: 400 }
      );
    }

    const providerCost =
      getPlanCost(plan);

    if (
      !Number.isFinite(providerCost) ||
      providerCost <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Selected data plan has an invalid provider price",
        },
        { status: 400 }
      );
    }

    const rates = await getRates();

    const customerPrice =
      percentPrice(
        providerCost,
        Number(rates.data || 0)
      );

    const customerKobo =
      Math.round(customerPrice * 100);

    const providerCostKobo =
      Math.round(providerCost * 100);

    reference =
      `data-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    await startServiceTransaction({
      userId,
      service: "DATA",
      amountKobo: customerKobo,
      reference,
      metadata: {
        network,
        data_plan,
        phone,
        providerCost,
        customerPrice,
      },
    });

    const result = await smeapi.data({
      network,
      data_plan,
      phone,
      ported_number: Boolean(
        b.ported_number
      ),
      ref: reference,
    });

    if (providerFailed(result)) {
      await failServiceTransaction({
        reference,
        reason:
          result?.message ||
          result?.provider_message ||
          "Data provider rejected transaction",
        metadata: {
          providerResponse: result,
        },
      });

      return NextResponse.json(
        {
          error:
            result?.message ||
            result?.provider_message ||
            "Data transaction failed",
        },
        { status: 400 }
      );
    }

    await completeServiceTransaction({
      reference,
      costKobo: providerCostKobo,
      providerTransactionId:
        providerReference(result)
          ? String(
              providerReference(result)
            )
          : undefined,
      metadata: {
        providerResponse: result,
        plan,
      },
    });

    const profit =
      customerPrice - providerCost;

    return NextResponse.json({
      ...result,

      reference,

      pricing: {
        providerCost,
        customerPrice,
        markup:
          Number(rates.data || 0),
        profit,
      },
    });
  } catch (e: any) {
    const s =
      e instanceof ProviderError
        ? e.status
        : e?.message === "UNAUTHORIZED"
        ? 401
        : e?.message ===
          "INSUFFICIENT_BALANCE"
        ? 400
        : 400;

    return NextResponse.json(
      {
        error:
          e.message ||
          "Unable to process data",
        details: e.details,
      },
      { status: s }
    );
  }
}