import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Settings } from "@/lib/models";
import { smeapi } from "@/lib/smeapi";
import { loadLegitdatawayDataPlans } from "@/lib/providers/legitdataway";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DataProvider = "SMEAPI" | "LEGITDATAWAY";

type NormalizedPlan = {
  id: string;
  provider: DataProvider;
  providerPlanId: string;
  providerNetworkId: string;
  networkId: string;
  network: string;
  name: string;
  price: number;
  type: string;
  days: string | number | null;
};

const NETWORKS: Record<string, string> = {
  "1": "MTN",
  "2": "AIRTEL",
  "3": "GLO",
  "4": "9MOBILE",
};

function asObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
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

function valueFrom(
  plan: any,
  keys: string[],
  fallback: any = ""
): any {
  for (const key of keys) {
    if (
      plan?.[key] !== undefined &&
      plan?.[key] !== null &&
      plan?.[key] !== ""
    ) {
      return plan[key];
    }
  }

  return fallback;
}

function getProviderPlanId(plan: any): string {
  return String(
    valueFrom(
      plan,
      ["id", "plan_id", "data_plan", "variation_id"],
      ""
    )
  ).trim();
}

function getProviderNetworkId(plan: any): string {
  return String(
    valueFrom(
      plan,
      ["network_id", "networkId", "network_code", "network"],
      ""
    )
  ).trim();
}

function getNetworkName(plan: any): string {
  return String(
    valueFrom(
      plan,
      ["network_name", "networkName", "network", "operator"],
      ""
    )
  )
    .trim()
    .toUpperCase();
}

function canonicalNetworkId(
  networkName: string,
  providerNetworkId: string,
  provider: DataProvider
): string {
  const name = networkName.replace(/[^A-Z0-9]/g, "");

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

  return ["1", "2", "3", "4"].includes(id) ? id : "";
}

function normalizePlan(
  plan: any,
  provider: DataProvider
): NormalizedPlan | null {
  const providerPlanId = getProviderPlanId(plan);
  const providerNetworkId = getProviderNetworkId(plan);

  const networkId = canonicalNetworkId(
    getNetworkName(plan),
    providerNetworkId,
    provider
  );

  if (
    !providerPlanId ||
    !/^\d+$/.test(providerPlanId) ||
    !networkId
  ) {
    return null;
  }

  const price = Number(
    valueFrom(
      plan,
      ["price", "amount", "selling_price", "cost"],
      0
    )
  );

  const name = String(
    valueFrom(
      plan,
      ["name", "plan_name", "title", "data"],
      ""
    )
  ).trim();

  const type = String(
    valueFrom(
      plan,
      [
        "type",
        "plan_type",
        "service_type",
        "serviceType",
        "datagroup",
      ],
      ""
    )
  ).trim();

  const daysValue = valueFrom(
    plan,
    ["days", "validity", "duration", "validity_days"],
    null
  );

  return {
    id: `${provider}:${providerPlanId}`,
    provider,
    providerPlanId,
    providerNetworkId,
    networkId,
    network: NETWORKS[networkId],
    name:
      name ||
      `${NETWORKS[networkId]} data plan ${providerPlanId}`,
    price: Number.isFinite(price) ? price : 0,
    type,
    days:
      typeof daysValue === "number" ||
      typeof daysValue === "string"
        ? daysValue
        : null,
  };
}

async function getProviderControls() {
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
    legacyNetworks: asObject(rates.sme_networks),
  };
}

async function getPlanAndServiceControls() {
  const [
    planSettings,
    providerSettings,
    serviceSettings,
  ] = await Promise.all([
    Settings.findOne({ key: "data_plan_controls" })
      .select("rates")
      .lean()
      .exec(),

    Settings.findOne({ key: "provider_controls" })
      .select("rates")
      .lean()
      .exec(),

    Settings.findOne({ key: "service_controls" })
      .select("rates")
      .lean()
      .exec(),
  ]);

  const planRates = asObject(
    (planSettings as any)?.rates
  );

  const providerRates = asObject(
    (providerSettings as any)?.rates
  );

  const serviceRates = asObject(
    (serviceSettings as any)?.rates
  );

  return {
    plans: asObject(planRates.plans),
    serviceTypes: asObject(planRates.service_types),
    legacyPlans: asObject(providerRates.sme_data_plans),
    legacyServiceTypes: asObject(
      providerRates.sme_service_types
    ),
    legacyNetworks: asObject(
      providerRates.sme_networks
    ),
    dataServiceEnabled: serviceRates.data !== false,
  };
}

function isProviderEnabled(
  provider: DataProvider,
  providerEnabled: Record<string, any>
): boolean {
  return providerEnabled[provider] !== false;
}

function isPlanAvailable(
  plan: NormalizedPlan,
  controls: Awaited<
    ReturnType<typeof getPlanAndServiceControls>
  >
): boolean {
  if (!controls.dataServiceEnabled) return false;

  if (controls.plans[plan.id] === false) {
    return false;
  }

  if (
    plan.provider === "SMEAPI" &&
    controls.legacyPlans[plan.providerPlanId] === false
  ) {
    return false;
  }

  if (
    plan.provider === "SMEAPI" &&
    controls.legacyNetworks[plan.providerNetworkId] === false
  ) {
    return false;
  }

  if (
    plan.type &&
    controls.serviceTypes[plan.provider]?.[
      plan.networkId
    ]?.[plan.type] === false
  ) {
    return false;
  }

  if (
    plan.provider === "SMEAPI" &&
    plan.type &&
    controls.legacyServiceTypes[
      plan.providerNetworkId
    ]?.[plan.type] === false
  ) {
    return false;
  }

  return true;
}

export async function GET() {
  try {
    await db();

    const [
      smeOutcome,
      legitOutcome,
      providerControls,
      planControls,
    ] = await Promise.all([
      smeapi.dataPlans()
        .then((data) => ({ data, error: null as string | null }))
        .catch((error: any) => ({
          data: null,
          error: String(
            error?.message ?? "SMEAPI catalogue request failed"
          ),
        })),

      loadLegitdatawayDataPlans()
        .then((data) => ({ data, error: null as string | null }))
        .catch((error: any) => ({
          data: null,
          error: String(
            error?.message ?? "LEGITDATAWAY catalogue request failed"
          ),
        })),

      getProviderControls(),
      getPlanAndServiceControls(),
    ]);

    const allPlans: NormalizedPlan[] = [
      ...getArray(smeOutcome.data, [
        "plans",
        "data",
        "data_plans",
        "results",
      ])
        .map((plan) => normalizePlan(plan, "SMEAPI"))
        .filter(
          (plan): plan is NormalizedPlan => Boolean(plan)
        ),

      ...getArray(legitOutcome.data, [
        "plans",
        "data",
        "data_plans",
        "results",
        "dataPlans",
      ])
        .map((plan) => normalizePlan(plan, "LEGITDATAWAY"))
        .filter(
          (plan): plan is NormalizedPlan => Boolean(plan)
        ),
    ];

    const selectedProviderByNetwork: Record<string, DataProvider> = {};
    const plans: NormalizedPlan[] = [];

    for (const networkId of Object.keys(NETWORKS)) {
      const configured = String(
        providerControls.dataProviders[networkId] ?? "SMEAPI"
      ).toUpperCase();

      const selectedProvider: DataProvider =
        configured === "LEGITDATAWAY"
          ? "LEGITDATAWAY"
          : "SMEAPI";

      selectedProviderByNetwork[networkId] = selectedProvider;

      if (
        !isProviderEnabled(
          selectedProvider,
          providerControls.providerEnabled
        )
      ) {
        continue;
      }

      if (
        selectedProvider === "SMEAPI" &&
        providerControls.legacyNetworks[networkId] === false
      ) {
        continue;
      }

      plans.push(
        ...allPlans.filter(
          (plan) =>
            plan.networkId === networkId &&
            plan.provider === selectedProvider &&
            isPlanAvailable(plan, planControls)
        )
      );
    }

    const serviceTypesByNetwork: Record<string, string[]> = {};

    for (const networkId of Object.keys(NETWORKS)) {
      serviceTypesByNetwork[networkId] = [
        ...new Set(
          plans
            .filter(
              (plan) =>
                plan.networkId === networkId && Boolean(plan.type)
            )
            .map((plan) => plan.type)
        ),
      ];
    }

    return NextResponse.json(
      {
        success: true,
        plans,
        serviceTypesByNetwork,
        selectedProviderByNetwork,
        errors: {
          SMEAPI: smeOutcome.error,
          LEGITDATAWAY: legitOutcome.error,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error("GET /api/sme/data-plans failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load data plans at the moment.",
        plans: [],
        serviceTypesByNetwork: {},
        selectedProviderByNetwork: {},
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}