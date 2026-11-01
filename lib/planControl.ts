import { Settings } from "@/lib/models";

type DataProvider = "SMEAPI" | "LEGITDATAWAY";

function asObject(value: any): Record<string, any> {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value
    : {};
}

async function getControls() {
  const [planSettings, providerSettings] = await Promise.all([
    Settings.findOne({ key: "data_plan_controls" })
      .select("rates")
      .lean()
      .exec(),
    Settings.findOne({ key: "provider_controls" })
      .select("rates")
      .lean()
      .exec(),
  ]);

  const newRates = asObject((planSettings as any)?.rates);
  const legacyRates = asObject((providerSettings as any)?.rates);

  return {
    plans: asObject(newRates.plans),
    serviceTypes: asObject(newRates.service_types),
    legacyPlans: asObject(legacyRates.sme_data_plans),
    legacyServiceTypes: asObject(legacyRates.sme_service_types),
    legacyNetworks: asObject(legacyRates.sme_networks),
  };
}

export async function isDataPlanEnabled(
  provider: DataProvider,
  planId: string | number,
  networkId: string | number,
  serviceType?: string
) {
  const controls = await getControls();
  const fullPlanId = `${provider}:${String(planId)}`;
  const network = String(networkId);
  const type = String(serviceType ?? "").trim();

  if (controls.plans[fullPlanId] === false) return false;

  if (
    provider === "SMEAPI" &&
    controls.legacyPlans[String(planId)] === false
  ) {
    return false;
  }

  if (
    provider === "SMEAPI" &&
    controls.legacyNetworks[network] === false
  ) {
    return false;
  }

  if (
    type &&
    controls.serviceTypes[provider]?.[network]?.[type] === false
  ) {
    return false;
  }

  if (
    provider === "SMEAPI" &&
    type &&
    controls.legacyServiceTypes[network]?.[type] === false
  ) {
    return false;
  }

  return true;
}

export async function assertDataPlanEnabled(
  provider: DataProvider,
  planId: string | number,
  networkId: string | number,
  serviceType?: string
) {
  if (
    !(await isDataPlanEnabled(
      provider,
      planId,
      networkId,
      serviceType
    ))
  ) {
    throw new Error("PLAN_DISABLED");
  }
}

// Backward compatibility for existing imports.
export async function isSmeDataPlanEnabled(
  planId: string | number
) {
  return isDataPlanEnabled("SMEAPI", planId, "");
}

export async function assertSmeDataPlanEnabled(
  planId: string | number
) {
  return assertDataPlanEnabled("SMEAPI", planId, "");
}