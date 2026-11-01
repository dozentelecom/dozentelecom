import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { Settings } from "@/lib/models";

export const dynamic = "force-dynamic";
const SERVICES = ["data", "airtime", "electricity", "cable", "education"] as const;
type ServiceKey = (typeof SERVICES)[number];
function isServiceKey(value: string): value is ServiceKey {
  return SERVICES.includes(value as ServiceKey);
}

export async function GET() {
  try {
    await requireAdminApi();
    await db();
    const settings: any = await Settings.findOne({ key: "service_controls" }).select("rates").lean().exec();
    const saved = settings?.rates || {};
    const services = SERVICES.reduce((result, service) => {
      result[service] = typeof saved[service] === "boolean" ? saved[service] : true;
      return result;
    }, {} as Record<ServiceKey, boolean>);
    return NextResponse.json({ success: true, services });
  } catch (error: unknown) {
    console.error("SERVICE CONTROLS GET ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ success: false, error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load service controls" }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const adminId = await requireAdminApi();
    await db();

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON request body" }, { status: 400 });
    }

    const service = String(body?.service || "").trim().toLowerCase();
    const enabled = body?.enabled;
    if (!isServiceKey(service)) {
      return NextResponse.json({ success: false, error: "Invalid service" }, { status: 400 });
    }
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "enabled must be true or false" }, { status: 400 });
    }

    const current: any = await Settings.findOne({ key: "service_controls" }).select("rates").lean().exec();
    const previousValue = typeof current?.rates?.[service] === "boolean" ? current.rates[service] : true;

    await Settings.findOneAndUpdate(
      { key: "service_controls" },
      { $set: { [`rates.${service}`]: enabled }, $setOnInsert: { key: "service_controls" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    const saved: any = await Settings.findOne({ key: "service_controls" }).select("rates").lean().exec();
    const persistedValue = typeof saved?.rates?.[service] === "boolean" ? saved.rates[service] : true;

    console.log(`ADMIN SERVICE CONTROL: ${adminId} changed ${service} from ${previousValue} to ${enabled}. Persisted: ${persistedValue}`);
    return NextResponse.json({ success: true, message: "Service control updated successfully", service, enabled: persistedValue, previousValue });
  } catch (error: unknown) {
    console.error("SERVICE CONTROLS PATCH ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ success: false, error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to update service" }, { status });
  }
}
