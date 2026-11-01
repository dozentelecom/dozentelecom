import { NextResponse } from "next/server";

import { smeapi, ProviderError } from "@/lib/smeapi";
import {
  purchaseData as legitdatawayPurchaseData,
  loadLegitdatawayDataPlans,
} from "@/lib/providers/legitdataway";

import { requirePin } from "@/lib/authz";
import { currentUserId } from "@/lib/session";
import { getRates } from "@/lib/settings";
import { percentPrice, getVipRate } from "@/lib/pricing";

import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";

import { assertServiceEnabled } from "@/lib/serviceControl";
import { assertSmeNetworkEnabled } from "@/lib/providerControl";
import { assertDataPlanEnabled } from "@/lib/planControl";

import {
  startServiceTransaction,
  processServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

export const dynamic = "force-dynamic";

type DataProvider = "SMEAPI" | "LEGITDATAWAY";

const NETWORKS: Record<string, string> = {
  "1": "MTN",
  "2": "AIRTEL",
  "3": "GLO",
  "4": "9MOBILE",
};

function asObject(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function getArray(value: any, keys: string[]): any[] {
  if (Array.isArray(value)) return value;

  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }

  if (Array.isArray(value?.data?.plans)) return value.data.plans;
  if (Array.isArray(value?.data?.results)) return value.data.results;
  if (Array.isArray(value?.data)) return value.data;

  return [];
}

function getPlanId(plan: any): string {
  return String(
    plan?.id ??
      plan?.plan_id ??
      plan?.data_plan ??
      plan?.variation_id ??
      ""
  ).trim();
}

function getPlanNetworkId(plan: any): string {
  return String(
    plan?.network_id ??
      plan?.networkId ??
      plan?.network_code ??
      plan?.network ??
      ""
  ).trim();
}

function getPlanNetworkName(plan: any): string {
  return String(
    plan?.network_name ??
      plan?.networkName ??
      plan?.network ??
      plan?.operator ??
      ""
  )
    .trim()
    .toUpperCase();
}

function getPlanType(plan: any): string {
  return String(
    plan?.type ??
      plan?.plan_type ??
      plan?.service_type ??
      plan?.serviceType ??
      plan?.datagroup ??
      ""
  ).trim();
}

function getPlanCost(plan: any): number {
  return Number(
    plan?.price ??
      plan?.amount ??
      plan?.selling_price ??
      plan?.cost ??
      0
  );
}

function canonicalNetworkId(
  networkName: string,
  providerNetworkId: string,
  provider: DataProvider
): string {
  const name = networkName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (name.includes("MTN")) return "1";
  if (name.includes("AIRTEL")) return "2";
  if (name.includes("GLO")) return "3";

  if (
    name.includes("9MOBILE") ||
    name.includes("9MOB") ||
    name.includes("ETISALAT")
  ) {
    return "4";
  }

  const id = String(providerNetworkId);

  if (provider === "LEGITDATAWAY") {
    const legitMap: Record<string, string> = {
      "1": "1",
      "2": "3",
      "3": "2",
      "4": "4",
    };

    return legitMap[id] || "";
  }

  const smeMap: Record<string, string> = {
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
  };

  return smeMap[id] || "";
}

function parseSelectedPlan(value: any): {
  provider: DataProvider;
  providerPlanId: string;
} | null {
  const raw = String(value ?? "").trim();
  const separator = raw.indexOf(":");

  if (separator <= 0) return null;

  const providerText = raw.slice(0, separator).toUpperCase();
  const providerPlanId = raw.slice(separator + 1).trim();

  if (
    providerText !== "SMEAPI" &&
    providerText !== "LEGITDATAWAY"
  ) {
    return null;
  }

  if (!providerPlanId || !/^\d+$/.test(providerPlanId)) {
    return null;
  }

  return {
    provider: providerText,
    providerPlanId,
  };
}

async function getProviderSettings() {
  const settings: any = await Settings.findOne({
    key: "provider_controls",
  })
    .select("rates")
    .lean()
    .exec();

  const rates = asObject(settings?.rates);

  return {
    dataProviders: asObject(rates.data_providers),
    providerEnabled: asObject(rates.data_provider_enabled),
  };
}

function isProviderEnabled(
  provider: DataProvider,
  providerEnabled: Record<string, any>
): boolean {
  return providerEnabled[provider] !== false;
}

function isProviderPlanEnabled(result: any): boolean {
  const plans = getArray(result, [
    "plans",
    "data",
    "data_plans",
    "results",
  ]);

  return plans.some((plan) => {
    const id = getPlanId(plan);

    return (
      id &&
      (plan?.enabled === false ||
        plan?.is_enabled === false ||
        plan?.active === false ||
        plan?.status === "disabled")
    );
  });
}

function findSmePlan(
  rawResult: any,
  requestedPlanId: string,
  canonicalNetwork: string
) {
  const plans = getArray(rawResult, [
    "plans",
    "data",
    "data_plans",
    "results",
  ]);

  for (const plan of plans) {
    const id = getPlanId(plan);
    const providerNetworkId = getPlanNetworkId(plan);
    const networkName = getPlanNetworkName(plan);

    const planCanonicalNetwork = canonicalNetworkId(
      networkName,
      providerNetworkId,
      "SMEAPI"
    );

    if (
      id === requestedPlanId &&
      planCanonicalNetwork === canonicalNetwork
    ) {
      return plan;
    }
  }

  return null;
}

function findLegitdatawayPlan(
  rawResult: any,
  requestedPlanId: string,
  canonicalNetwork: string
) {
  const plans = getArray(rawResult, [
    "plans",
    "data",
    "results",
    "dataPlans",
  ]);

  for (const plan of plans) {
    const id = getPlanId(plan);
    const providerNetworkId = getPlanNetworkId(plan);
    const networkName = getPlanNetworkName(plan);

    const planCanonicalNetwork = canonicalNetworkId(
      networkName,
      providerNetworkId,
      "LEGITDATAWAY"
    );

    if (
      id === requestedPlanId &&
      planCanonicalNetwork === canonicalNetwork
    ) {
      return plan;
    }
  }

  return null;
}

function providerFailed(result: any): boolean {
  const status = String(
    result?.status ?? result?.data?.status ?? ""
  ).toLowerCase();

  return (
    result?.success === false ||
    result?.status === false ||
    ["failed", "failure", "error", "reversed", "declined"].includes(
      status
    )
  );
}

function providerSuccess(result: any): boolean {
  const status = String(
    result?.status ?? result?.data?.status ?? ""
  ).toLowerCase();

  return (
    result?.success === true ||
    ["success", "successful", "completed", "complete"].includes(status)
  );
}

function providerReference(result: any): string {
  return String(
    result?.reference ??
      result?.transaction_reference ??
      result?.transactionId ??
      result?.id ??
      result?.data?.reference ??
      result?.data?.transaction_reference ??
      ""
  ).trim();
}

function isDefiniteProviderRejection(error: any): boolean {
  const status = Number(
    error?.status ?? error?.statusCode ?? 0
  );

  /*
   * Treat normal 4xx errors as definite rejection.
   * 408 and 429 can have uncertain outcomes, so leave them pending.
   */
  return (
    status >= 400 &&
    status < 500 &&
    status !== 408 &&
    status !== 429
  );
}

function errorMessage(error: any): string {
  return String(
    error?.message ?? "Unable to process data purchase."
  );
}

export async function POST(req: Request) {
  let reference = "";

  try {
    const body = await req.json();

    /*
     * Validate the customer's transaction PIN first.
     * Never persist or log this value.
     */
    await requirePin(String(body?.pin ?? ""));

    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const network = String(body?.network ?? "").trim();
    const phone = String(body?.phone ?? "").trim();
    const selectedPlan = parseSelectedPlan(body?.data_plan);

    if (!NETWORKS[network]) {
      return NextResponse.json(
        { success: false, error: "Please select a valid network." },
        { status: 400 }
      );
    }

    if (!selectedPlan) {
      return NextResponse.json(
        {
          success: false,
          error: "Please select a valid data plan and try again.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{11}$/.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid 11-digit Nigerian phone number.",
        },
        { status: 400 }
      );
    }

    await db();
    await assertServiceEnabled("data");

    const { dataProviders, providerEnabled } =
      await getProviderSettings();

    const selectedProvider = String(
      dataProviders[network] ?? "SMEAPI"
    ).toUpperCase() as DataProvider;

    if (
      selectedProvider !== "SMEAPI" &&
      selectedProvider !== "LEGITDATAWAY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected data provider is not configured.",
        },
        { status: 503 }
      );
    }

    /*
     * Do not automatically switch providers.
     * The plan must belong to the provider selected by the admin.
     */
    if (selectedPlan.provider !== selectedProvider) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This plan is no longer available for the selected provider. Refresh the data plans and try again.",
        },
        { status: 409 }
      );
    }

    if (!isProviderEnabled(selectedProvider, providerEnabled)) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected data provider is currently disabled.",
        },
        { status: 403 }
      );
    }

    /*
     * SMEAPI-only controls must not block Legitdataway plans.
     */
    if (selectedProvider === "SMEAPI") {
      await assertSmeNetworkEnabled(network);
    }

    const user: any = await User.findById(userId)
      .select("vipLevel")
      .lean()
      .exec();

    const vipLevel = String(user?.vipLevel ?? "NORMAL");

    let providerPlan: any = null;
    let providerCost = 0;
    let serviceType = "";
    let providerNetworkId = "";

    /*
     * Fetch the selected provider's catalogue and confirm that
     * the plan still exists on the selected canonical network.
     */
    if (selectedProvider === "SMEAPI") {
      const rawCatalogue = await smeapi.dataPlans();

      providerPlan = findSmePlan(
        rawCatalogue,
        selectedPlan.providerPlanId,
        network
      );

      if (!providerPlan) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This SMEAPI data plan is unavailable. Refresh the plans and try again.",
          },
          { status: 409 }
        );
      }

      providerCost = getPlanCost(providerPlan);
      serviceType = getPlanType(providerPlan);
      providerNetworkId = getPlanNetworkId(providerPlan);

      if (!serviceType) {
        return NextResponse.json(
          {
            success: false,
            error: "This data plan has no valid service type.",
          },
          { status: 400 }
        );
      }
    } else {
      const rawCatalogue = await loadLegitdatawayDataPlans();

      providerPlan = findLegitdatawayPlan(
        rawCatalogue,
        selectedPlan.providerPlanId,
        network
      );

      if (!providerPlan) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This Legitdataway data plan is unavailable. Refresh the plans and try again.",
          },
          { status: 409 }
        );
      }

      providerCost = getPlanCost(providerPlan);
      serviceType = getPlanType(providerPlan);
      providerNetworkId = getPlanNetworkId(providerPlan);
    }

    /*
     * Enforce the individual plan and service-type controls for BOTH
     * providers before pricing or starting/debiting the transaction.
     * The helper also honours legacy SMEAPI controls for compatibility.
     */
    await assertDataPlanEnabled(
      selectedProvider,
      selectedPlan.providerPlanId,
      network,
      serviceType
    );

    if (!Number.isFinite(providerCost) || providerCost <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The selected data plan has an invalid price.",
        },
        { status: 400 }
      );
    }

    if (!providerNetworkId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The provider network ID is missing for this plan. Please contact support.",
        },
        { status: 503 }
      );
    }

    /*
     * Preserve the existing normal/VIP pricing rules.
     */
    const rates = await getRates();
    const markup = getVipRate(rates, vipLevel, "data");
    const customerPrice = percentPrice(providerCost, markup);
    const customerKobo = Math.round(customerPrice * 100);

    reference = `data-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    /*
     * Debit/create the transaction using the existing lifecycle.
     */
    await startServiceTransaction({
      userId,
      service: "DATA",
      amountKobo: customerKobo,
      reference,
      metadata: {
        network,
        networkName: NETWORKS[network],
        data_plan: selectedPlan.providerPlanId,
        phone,
        serviceType,
        vipLevel,
        providerCost,
        customerPrice,
        markup,
        provider: selectedProvider,
        providerPlanId: selectedPlan.providerPlanId,
        providerNetworkId,
      },
    });

    await processServiceTransaction({ reference });

    let result: any;

    try {
      if (selectedProvider === "SMEAPI") {
        result = await smeapi.data({
          network: Number(providerNetworkId),
          data_plan: Number(selectedPlan.providerPlanId),
          phone,
          ported_number: body?.ported_number ? "true" : "false",
          ref: reference,
        });
      } else {
        result = await legitdatawayPurchaseData({
          network: Number(providerNetworkId),
          phone: `234${phone.slice(1)}`,
          data_plan: Number(selectedPlan.providerPlanId),
          bypass: false,
          requestId: reference,
        });
      }
    } catch (providerError: any) {
      /*
       * If the provider definitely rejected the request, fail the
       * transaction through the existing failure/refund lifecycle.
       *
       * For network errors, timeouts, 5xx, 408 or 429, the result may
       * be uncertain. Keep the transaction pending; do not refund or
       * automatically retry a purchase that may have succeeded.
       */
      if (isDefiniteProviderRejection(providerError)) {
        await failServiceTransaction({
          reference,
          reason: errorMessage(providerError),
          metadata: {
            provider: selectedProvider,
            providerPlanId: selectedPlan.providerPlanId,
            providerNetworkId,
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: errorMessage(providerError),
            reference,
            status: "failed",
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          pending: true,
          reference,
          status: "pending",
          message:
            "Your data purchase is being confirmed. Please check your transaction history before trying again.",
        },
        { status: 202 }
      );
    }

    if (providerFailed(result)) {
      await failServiceTransaction({
        reference,
        reason: "The provider reported that the data purchase failed.",
        metadata: {
          provider: selectedProvider,
          providerPlanId: selectedPlan.providerPlanId,
          providerNetworkId,
          providerResponse: result,
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: "The data provider reported that the purchase failed.",
          reference,
          status: "failed",
        },
        { status: 400 }
      );
    }

    /*
     * A response that is neither explicit success nor explicit failure
     * remains pending. Do not treat an ambiguous response as a failure.
     */
    if (!providerSuccess(result)) {
      return NextResponse.json(
        {
          success: true,
          pending: true,
          reference,
          status: "pending",
          message:
            "Your data purchase is being confirmed. Please check your transaction history before trying again.",
        },
        { status: 202 }
      );
    }

    await completeServiceTransaction({
      reference,
      costKobo: Math.round(providerCost * 100),
      providerTransactionId: providerReference(result),
      metadata: {
        provider: selectedProvider,
        providerPlanId: selectedPlan.providerPlanId,
        providerNetworkId,
        providerResponse: result,
        plan: providerPlan,
        serviceType,
      },
    });

    return NextResponse.json({
      success: true,
      pending: false,
      status: "success",
      reference,
      provider: selectedProvider,
      providerPlanId: selectedPlan.providerPlanId,
      serviceType,
      pricing: {
        cost: providerCost,
        markup,
        amount: customerPrice,
      },
      data: result,
    });
  } catch (error: any) {
    const message = errorMessage(error);

    const status =
      error instanceof ProviderError
        ? error.status
        : message === "UNAUTHORIZED"
          ? 401
          : message === "INSUFFICIENT_BALANCE"
            ? 400
            : message === "SERVICE_DISABLED" ||
                message === "PROVIDER_DISABLED" ||
                message === "PLAN_DISABLED" ||
                message === "SERVICE_TYPE_DISABLED"
              ? 403
              : 400;

    const friendlyMessage =
      message === "UNAUTHORIZED"
        ? "Please sign in again."
        : message === "INSUFFICIENT_BALANCE"
          ? "Your wallet balance is insufficient."
          : message === "SERVICE_DISABLED"
            ? "Data service is currently disabled."
            : message === "PROVIDER_DISABLED"
              ? "The selected data provider is currently disabled."
              : message === "PLAN_DISABLED"
                ? "This data plan is currently disabled."
                : message === "SERVICE_TYPE_DISABLED"
                  ? "This data service type is currently disabled."
                  : message;

    return NextResponse.json(
      {
        success: false,
        error: friendlyMessage,
        ...(reference ? { reference } : {}),
      },
      { status }
    );
  }
}