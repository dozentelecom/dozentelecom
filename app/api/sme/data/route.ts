import { NextResponse } from "next/server";

import {
  smeapi,
  ProviderError,
} from "@/lib/smeapi";

import { requirePin } from "@/lib/authz";
import { currentUserId } from "@/lib/session";
import { getRates } from "@/lib/settings";
import {
  percentPrice,
  getVipRate,
} from "@/lib/pricing";

import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";

import {
  assertServiceEnabled,
} from "@/lib/serviceControl";

import {
  assertSmeNetworkEnabled,
} from "@/lib/providerControl";

import {
  assertSmeDataPlanEnabled,
} from "@/lib/planControl";

import {
  startServiceTransaction,
  processServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

/* =========================================================
   GET PLANS FROM SME RESPONSE
   ========================================================= */

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

  if (Array.isArray(result?.results)) {
    return result.results;
  }

  return [];
}

/* =========================================================
   GET PLAN ID
   ========================================================= */

function getPlanId(plan: any) {
  return String(
    plan?.id ??
      plan?.plan_id ??
      plan?.data_plan ??
      ""
  ).trim();
}

/* =========================================================
   GET PLAN NETWORK
   ========================================================= */

function getPlanNetwork(plan: any) {
  return String(
    plan?.network_id ??
      plan?.network ??
      ""
  ).trim();
}

/* =========================================================
   GET PLAN SERVICE TYPE
   ========================================================= */

function getPlanServiceType(plan: any) {
  return String(
    plan?.type ??
      plan?.service_type ??
      plan?.serviceType ??
      ""
  ).trim();
}

/* =========================================================
   GET PLAN COST
   ========================================================= */

function getPlanCost(plan: any) {
  return Number(
    plan?.price ??
      plan?.amount ??
      plan?.selling_price ??
      plan?.cost ??
      0
  );
}

/* =========================================================
   CHECK PROVIDER FAILURE
   ========================================================= */

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
      [
        "failed",
        "error",
        "reversed",
      ].includes(
        String(v).toLowerCase()
      )
  );
}

/* =========================================================
   CHECK PROVIDER SUCCESS
   ========================================================= */

function providerSuccess(result: any) {
  const values = [
    result?.success,
    result?.status,
    result?.data?.success,
    result?.data?.status,
  ];

  return values.some(
    (v) =>
      v === true ||
      [
        "success",
        "successful",
        "completed",
        "complete",
      ].includes(
        String(v).toLowerCase()
      )
  );
}

/* =========================================================
   PROVIDER REFERENCE
   ========================================================= */

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

/* =========================================================
   SME SERVICE TYPE CONTROL
   =========================================================
   Service types are stored independently per network:

   sme_service_types: {
     "1": {
       SME: true,
       Sharecoupon: false
     },
     "2": {
       SME: true
     },
     "4": {
       SME: true
     }
   }

   Missing service type = ENABLED.
   ========================================================= */

async function assertSmeServiceTypeEnabled(
  networkId: string | number,
  serviceType: string
) {
  const settings: any =
    await Settings.findOne({
      key: "provider_controls",
    })
      .select("rates")
      .lean();

  const controls =
    settings?.rates
      ?.sme_service_types;

  const networkControls =
    controls?.[String(networkId)];

  const enabled =
    networkControls?.[serviceType] !== false;

  if (!enabled) {
    throw new Error(
      "SERVICE_TYPE_DISABLED"
    );
  }
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: Request
) {
  let reference = "";

  try {
    const b = await req.json();

    /* =======================================================
       PIN
       ======================================================= */

    await requirePin(
      String(b.pin || "")
    );

    /* =======================================================
       AUTH
       ======================================================= */

    const userId =
      await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "UNAUTHORIZED",
        },
        {
          status: 401,
        }
      );
    }

    /* =======================================================
       READ + VALIDATE INPUT
       ======================================================= */

    const network =
      Number(b.network);

    const data_plan =
      Number(b.data_plan);

    const phone =
      String(b.phone || "");

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
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       DATABASE
       ======================================================= */

    await db();

    /* =======================================================
       GLOBAL DATA SERVICE CONTROL
       ======================================================= */

    await assertServiceEnabled(
      "data"
    );

    /* =======================================================
       NETWORK CONTROL
       ======================================================= */

    await assertSmeNetworkEnabled(
      network
    );

    /* =======================================================
       INDIVIDUAL PLAN CONTROL
       ======================================================= */

    await assertSmeDataPlanEnabled(
      data_plan
    );

    /* =======================================================
       LOAD CUSTOMER VIP LEVEL
       ======================================================= */

    const user: any =
      await User.findById(userId)
        .select("vipLevel")
        .lean();

    const vipLevel =
      user?.vipLevel ||
      "NORMAL";

    /* =======================================================
       LOAD LIVE SME PLANS

       NEVER TRUST PRICE OR SERVICE TYPE FROM BROWSER.
       ======================================================= */

    const rawPlans =
      await smeapi.dataPlans();

    const plans =
      getPlans(rawPlans);

    /* =======================================================
       FIND SELECTED PLAN

       The plan must match both:
       - selected plan ID
       - selected network
       ======================================================= */

    const plan =
      plans.find((p: any) => {
        const idMatches =
          getPlanId(p) ===
          String(data_plan);

        const networkValue =
          getPlanNetwork(p);

        const networkMatches =
          !networkValue ||
          networkValue ===
            String(network);

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
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       GET SERVICE TYPE FROM SMEAPI

       Example:
       SME
       Sharecoupon
       etc.

       We do NOT trust service_type from browser.
       ======================================================= */

    const serviceType =
      getPlanServiceType(plan);

    if (!serviceType) {
      return NextResponse.json(
        {
          error:
            "Selected data plan has no service type",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       SERVICE TYPE CONTROL

       Example:

       MTN (network 1)
       Sharecoupon = disabled

       Airtel (network 4)
       Sharecoupon = enabled

       Only MTN Sharecoupon will be blocked.
       ======================================================= */

    await assertSmeServiceTypeEnabled(
      network,
      serviceType
    );

    /* =======================================================
       PROVIDER COST

       NEVER TRUST PRICE SENT BY BROWSER.
       ======================================================= */

    const providerCost =
      getPlanCost(plan);

    if (
      !Number.isFinite(
        providerCost
      ) ||
      providerCost <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Selected data plan has an invalid provider price",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       LOAD PRICING
       ======================================================= */

    const rates =
      await getRates();

    /* =======================================================
       VIP-AWARE DATA RATE
       ======================================================= */

    const markup =
      getVipRate(
        rates,
        vipLevel,
        "data"
      );

    const customerPrice =
      percentPrice(
        providerCost,
        markup
      );

    const customerKobo =
      Math.round(
        customerPrice * 100
      );

    const providerCostKobo =
      Math.round(
        providerCost * 100
      );

    /* =======================================================
       TRANSACTION REFERENCE
       ======================================================= */

    reference =
      `data-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    /* =======================================================
       DEBIT CUSTOMER
       ======================================================= */

    await startServiceTransaction({
      userId,
      service: "DATA",
      amountKobo:
        customerKobo,
      reference,

      metadata: {
        network,
        data_plan,
        phone,
        serviceType,
        vipLevel,
        providerCost,
        customerPrice,
        markup,
      },
    });

    await processServiceTransaction({
      reference,
    });

        /* =======================================================
       SME PROVIDER PURCHASE
       ======================================================= */

    let result: any;

try {
  result = await smeapi.data({
    network,
    data_plan,
    phone,
    ported_number:
      b.ported_number
        ? "true"
        : "false",
    ref: reference,
  });
} catch (providerError: any) {
  /*
   * IMPORTANT:
   *
   * 4xx = definite provider rejection.
   * Refund customer.
   *
   * 5xx / timeout = provider outcome is uncertain.
   * DO NOT automatically refund because the provider
   * may have received the request.
   */

  const isUncertain =
    providerError instanceof ProviderError &&
    (
      providerError.status >= 500 ||
      providerError.status === 504 ||
      providerError.message
        ?.toLowerCase()
        .includes("timeout")
    );

  if (isUncertain) {
    /*
     * Leave transaction pending/processing.
     *
     * Do not refund automatically.
     */
    return NextResponse.json(
      {
        success: true,
        pending: true,
        message:
          "Data transaction is being verified. Please check transaction status shortly.",
        reference,
      },
      {
        status: 202,
      }
    );
  }

  /*
   * Definite provider rejection.
   *
   * Customer gets their wallet money back.
   */
  await failServiceTransaction({
    reference,
    reason:
      providerError?.message ||
      "Data provider rejected transaction",
    metadata: {
      providerError:
        providerError?.details,
    },
  });

  return NextResponse.json(
    {
      error:
        providerError?.message ||
        "Data transaction failed",
      reference,
    },
    {
      status:
        providerError instanceof ProviderError
          ? providerError.status
          : 400,
    }
  );
}

    /* =======================================================
       PROVIDER FAILURE
       ======================================================= */

    if (providerFailed(result)) {
      await failServiceTransaction({
        reference,

        reason:
          result?.message ||
          result?.provider_message ||
          "Data provider rejected transaction",

        metadata: {
          providerResponse:
            result,
        },
      });

      return NextResponse.json(
        {
          error:
            result?.message ||
            result?.provider_message ||
            "Data transaction failed",

          reference,
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       PROVIDER PENDING / UNCERTAIN
       ======================================================= */

    if (!providerSuccess(result)) {
  await processServiceTransaction({
    reference,
    metadata: {
      providerResponse: result,
      providerStatus:
        result?.status ||
        result?.data?.status ||
        "UNKNOWN",
    },
  });

  return NextResponse.json(
    {
      success: true,
      pending: true,
      message:
        "Data transaction is being processed. Please check transaction status shortly.",
      reference,
      providerResponse: result,
    },
    {
      status: 202,
    }
  );
}

    /* =======================================================
       COMPLETE TRANSACTION
       ======================================================= */

    await completeServiceTransaction({
      reference,

      costKobo:
        providerCostKobo,

      providerTransactionId:
        providerReference(
          result
        )
          ? String(
              providerReference(
                result
              )
            )
          : undefined,

      metadata: {
        providerResponse:
          result,

        plan,

        serviceType,
      },
    });

    /* =======================================================
       PROFIT
       ======================================================= */

    const profit =
      customerPrice -
      providerCost;

    /* =======================================================
       RESPONSE
       ======================================================= */

    return NextResponse.json({
      ...result,

      reference,

      pricing: {
        providerCost,
        customerPrice,
        markup,
        profit,
        vipLevel,
      },

      serviceType,
    });
  } catch (e: any) {
    /* =======================================================
       ERROR STATUS
       ======================================================= */

    const status =
      e instanceof ProviderError
        ? e.status
        : e?.message ===
          "UNAUTHORIZED"
        ? 401
        : e?.message ===
          "INSUFFICIENT_BALANCE"
        ? 400
        : e?.message ===
          "SERVICE_DISABLED"
        ? 403
        : e?.message ===
          "PROVIDER_DISABLED"
        ? 403
        : e?.message ===
          "PLAN_DISABLED"
        ? 403
        : e?.message ===
          "SERVICE_TYPE_DISABLED"
        ? 403
        : 400;

    /* =======================================================
       USER-FRIENDLY ERROR
       ======================================================= */

    const errorMessage =
      e?.message ===
      "SERVICE_DISABLED"
        ? "Data service is temporarily unavailable."
        : e?.message ===
          "PROVIDER_DISABLED"
        ? "This network is temporarily unavailable."
        : e?.message ===
          "PLAN_DISABLED"
        ? "This data plan is temporarily unavailable."
        : e?.message ===
          "SERVICE_TYPE_DISABLED"
        ? "This service type is temporarily unavailable for this network."
        : e?.message ||
          "Unable to process data";

    return NextResponse.json(
      {
        error:
          errorMessage,

        details:
          e?.details,

        reference,
      },
      {
        status,
      }
    );
  }
}