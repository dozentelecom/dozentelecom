import { Settings } from "@/lib/models";

export type ProviderControlGroup =
  | "sme_networks"
  | "wisesub_electricity"
  | "wisesub_cable"
  | "wisesub_education";

async function getProviderControls() {
  const settings: any = await Settings.findOne({
    key: "provider_controls",
  })
    .select("rates")
    .lean();

  return settings?.rates || {};
}

/* =========================================================
   SME NETWORKS
   ========================================================= */

export async function isSmeNetworkEnabled(
  networkId: string | number
) {
  const controls = await getProviderControls();

  return (
    controls?.sme_networks?.[String(networkId)] !== false
  );
}

export async function assertSmeNetworkEnabled(
  networkId: string | number
) {
  const enabled =
    await isSmeNetworkEnabled(networkId);

  if (!enabled) {
    throw new Error("PROVIDER_DISABLED");
  }
}

/* =========================================================
   WISESUB PROVIDERS
   ========================================================= */

export async function isWiseSubProviderEnabled(
  group:
    | "wisesub_electricity"
    | "wisesub_cable"
    | "wisesub_education",
  providerCode: string
) {
  const controls = await getProviderControls();

  return (
    controls?.[group]?.[String(providerCode)] !== false
  );
}

export async function assertWiseSubProviderEnabled(
  group:
    | "wisesub_electricity"
    | "wisesub_cable"
    | "wisesub_education",
  providerCode: string
) {
  const enabled =
    await isWiseSubProviderEnabled(
      group,
      providerCode
    );

  if (!enabled) {
    throw new Error("PROVIDER_DISABLED");
  }
}