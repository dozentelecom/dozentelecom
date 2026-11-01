import { getDataCatalogue } from "./client";
import { normalizeDataCatalogue } from "./normalize";

export async function loadLegitdatawayDataPlans() {
  const raw = await getDataCatalogue();
  return normalizeDataCatalogue(raw);
}