import { Settings } from "@/lib/models";

/*
|--------------------------------------------------------------------------
| DATA PLAN CONTROLS
|--------------------------------------------------------------------------
|
| Stored under:
|
| provider_controls.rates.sme_data_plans
|
| Example:
|
| {
|   "1": true,
|   "2": false
| }
|
| The key is the SME plan ID.
|
*/

async function getPlanControls() {
  const settings: any = await Settings.findOne({
    key: "provider_controls",
  })
    .select("rates")
    .lean();

  return settings?.rates?.sme_data_plans || {};
}

export async function isSmeDataPlanEnabled(
  planId: string | number
) {
  const controls = await getPlanControls();

  /*
   * Missing plan control = enabled.
   */
  return controls?.[String(planId)] !== false;
}

export async function assertSmeDataPlanEnabled(
  planId: string | number
) {
  const enabled =
    await isSmeDataPlanEnabled(planId);

  if (!enabled) {
    throw new Error("PLAN_DISABLED");
  }
}