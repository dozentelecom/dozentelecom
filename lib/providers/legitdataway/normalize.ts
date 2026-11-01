import type {
  LegitdatawayCatalogResult,
  LegitdatawayPlan,
} from "./types";

function first(obj: any, keys: string[]) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[?,\s]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function findArray(value: any): any[] | null {
  if (Array.isArray(value)) return value;

  if (!value || typeof value !== "object") return null;

  const preferred = [
    "data",
    "plans",
    "result",
    "results",
    "packages",
    "records",
    "rows",
    "items",
    "networks",
  ];

  for (const key of preferred) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
  }

  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate)) return candidate;
  }

  return null;
}

export function normalizeDataCatalogue(raw: any): LegitdatawayCatalogResult {
  const array = findArray(raw) || [];

  const plans: LegitdatawayPlan[] = array
    .map((item: any) => {
      const id = first(item, [
        "id",
        "plan_id",
        "planId",
        "data_plan",
        "dataplan",
        "code",
      ]);

      if (id === undefined || id === null || id === "") return null;

      return {
        id,
        networkId: first(item, [
  "network_id",
  "networkId",
  "network_code",
  "network",
]),
        network: first(item, ["network_name", "networkName", "network"]),
        planName: first(item, [
          "plan_name",
          "planName",
          "name",
          "dataplan_name",
          "description",
        ]),
        planType: first(item, ["plan_type", "planType", "type"]),
        amount: numberValue(
          first(item, ["amount", "price", "cost", "selling_price"]),
        ),
        validity: first(item, [
          "validity",
          "duration",
          "days",
          "validity_period",
        ]),
        raw: item,
      } satisfies LegitdatawayPlan;
    })
    .filter(Boolean) as LegitdatawayPlan[];

  return {
    success: true,
    type: "data",
    plans,
    raw,
  };
}
