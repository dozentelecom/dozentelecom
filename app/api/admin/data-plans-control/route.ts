import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { Settings } from "@/lib/models";
import { smeapi } from "@/lib/smeapi";
import { loadLegitdatawayDataPlans } from "@/lib/providers/legitdataway";

export const dynamic = "force-dynamic";
const PROVIDERS = ["SMEAPI", "LEGITDATAWAY"] as const;
type Provider = (typeof PROVIDERS)[number];

function asObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function getArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  for (const key of ["data", "data_plans", "plans", "results"]) {
    if (Array.isArray(raw?.[key])) return raw[key];
  }
  return [];
}
function normalizeProvider(value: unknown): Provider | null {
  const provider = String(value || "").trim().toUpperCase();
  return PROVIDERS.includes(provider as Provider) ? provider as Provider : null;
}
function errorResponse(error: unknown, fallback: string) {
  const status = adminApiErrorStatus(error);
  return NextResponse.json({
    success: false,
    error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : fallback,
  }, { status });
}

async function loadCatalogue() {
  const [smeResult, legitResult] = await Promise.allSettled([smeapi.dataPlans(), loadLegitdatawayDataPlans()]);
  const plans: any[] = [];
  const errors: Record<string, string> = {};

  function addPlans(provider: Provider, raw: any) {
    for (const plan of getArray(raw)) {
      if (!plan) continue;
      const providerPlanId = plan.id ?? plan.plan_id ?? plan.planId;
      const providerNetworkId = String(plan.network_id ?? plan.networkId ?? plan.network ?? "");
      if (providerPlanId == null || !providerNetworkId) continue;

      let networkId = Number(providerNetworkId);
      if (provider === "LEGITDATAWAY") {
        networkId = ({ 1: 1, 2: 3, 3: 2, 4: 4 } as Record<number, number>)[networkId] ?? networkId;
      }
      const networkNames: Record<number, string> = { 1: "MTN", 2: "AIRTEL", 3: "GLO", 4: "9MOBILE" };
      if (!networkNames[networkId]) continue;

      plans.push({
        id: `${provider}:${String(providerPlanId)}`,
        provider,
        providerPlanId: String(providerPlanId),
        providerNetworkId,
        networkId,
        network: networkNames[networkId],
        name: String(plan.name ?? plan.plan_name ?? plan.data ?? "Data plan"),
        type: String(plan.type ?? plan.plan_type ?? plan.service_type ?? "OTHER"),
        days: String(plan.days ?? plan.validity ?? plan.duration ?? ""),
        price: Number(plan.price ?? plan.amount ?? 0),
      });
    }
  }

  if (smeResult.status === "fulfilled") addPlans("SMEAPI", smeResult.value);
  else errors.SMEAPI = "Unable to load SMEAPI plans";
  if (legitResult.status === "fulfilled") addPlans("LEGITDATAWAY", legitResult.value);
  else errors.LEGITDATAWAY = "Unable to load LEGITDATAWAY plans";

  return { plans, errors };
}

async function readControls() {
  const [settings, legacySettings] = await Promise.all([
    Settings.findOne({ key: "data_plan_controls" }).select("rates").lean().exec(),
    Settings.findOne({ key: "provider_controls" }).select("rates").lean().exec(),
  ]);
  const rates = asObject((settings as any)?.rates);
  const legacy = asObject((legacySettings as any)?.rates);
  return {
    plans: { ...asObject(rates.plans) },
    service_types: { ...asObject(rates.service_types) },
    legacy_sme_data_plans: { ...asObject(legacy.sme_data_plans) },
    legacy_sme_service_types: { ...asObject(legacy.sme_service_types) },
  };
}

export async function GET() {
  try {
    await requireAdminApi();
    await db();
    const [{ plans, errors }, controls] = await Promise.all([loadCatalogue(), readControls()]);
    return NextResponse.json({ success: true, plans, controls, errors }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("GET data-plan-controls:", error);
    return errorResponse(error, "Unable to load data plan controls");
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdminApi();
    await db();

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON request body" }, { status: 400 });
    }

    const group = String(body?.group ?? "");
    const enabled = body?.enabled;
    const planId = String(body?.planId ?? "");
    const provider = normalizeProvider(body?.provider);
    const networkId = String(body?.networkId ?? "");
    const serviceType = String(body?.serviceType ?? "").trim();

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "enabled must be true or false" }, { status: 400 });
    }

    const set: Record<string, boolean> = {};
    if (group === "plan") {
      if (!provider || !planId.startsWith(`${provider}:`) || !planId.slice(provider.length + 1)) {
        return NextResponse.json({ success: false, error: "Invalid provider or plan ID" }, { status: 400 });
      }
      set[`rates.plans.${planId}`] = enabled;

      if (provider === "SMEAPI") {
        const legacyId = planId.slice("SMEAPI:".length);
        if (/^[\w-]+$/.test(legacyId)) {
          await Settings.findOneAndUpdate(
            { key: "provider_controls" },
            { $set: { [`rates.sme_data_plans.${legacyId}`]: enabled }, $setOnInsert: { key: "provider_controls" } },
            { upsert: true }
          ).exec();
        }
      }
    } else if (group === "serviceType") {
      if (!provider || !["1", "2", "3", "4"].includes(networkId) || !serviceType || !/^[\w -]+$/.test(serviceType)) {
        return NextResponse.json({ success: false, error: "Invalid service type control" }, { status: 400 });
      }
      set[`rates.service_types.${provider}.${networkId}.${serviceType}`] = enabled;

      if (provider === "SMEAPI") {
        await Settings.findOneAndUpdate(
          { key: "provider_controls" },
          { $set: { [`rates.sme_service_types.${networkId}.${serviceType}`]: enabled }, $setOnInsert: { key: "provider_controls" } },
          { upsert: true }
        ).exec();
      }
    } else {
      return NextResponse.json({ success: false, error: "Unsupported control group" }, { status: 400 });
    }

    await Settings.findOneAndUpdate(
      { key: "data_plan_controls" },
      { $set: set, $setOnInsert: { key: "data_plan_controls" } },
      { upsert: true, new: true }
    ).exec();

    return NextResponse.json({ success: true, message: "Data plan control updated", controls: await readControls() });
  } catch (error: unknown) {
    console.error("PATCH data-plan-controls:", error);
    return errorResponse(error, "Unable to update data plan control");
  }
}
