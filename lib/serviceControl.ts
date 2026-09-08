import { Settings } from "@/lib/models";

export type ServiceControl =
  | "data"
  | "airtime"
  | "electricity"
  | "cable"
  | "education";

export async function isServiceEnabled(
  service: ServiceControl
) {
  const settings: any =
    await Settings.findOne({
      key: "service_controls",
    })
      .select("rates")
      .lean();

  /*
   * If no service-control setting exists,
   * services remain enabled by default.
   */
  return settings?.rates?.[service] !== false;
}

export async function assertServiceEnabled(
  service: ServiceControl
) {
  const enabled =
    await isServiceEnabled(service);

  if (!enabled) {
    const error = new Error(
      "SERVICE_DISABLED"
    );

    throw error;
  }
}