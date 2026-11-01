import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { Settings } from "@/lib/models";
import { DEFAULTS, assertRate, RateKey } from "@/lib/pricing";

const VIP_DEFAULTS = {
  vip1Price: 5000, vip2Price: 15000, vip3Price: 30000,
  vip1Data: 4, vip1Electricity: 3, vip1Cable: 3, vip1Education: 12, vip1AirtimeToCash: 18,
  vip2Data: 3, vip2Electricity: 2, vip2Cable: 2, vip2Education: 10, vip2AirtimeToCash: 15,
  vip3Data: 2, vip3Electricity: 1, vip3Cable: 1, vip3Education: 8, vip3AirtimeToCash: 12,
};
const VIP_RATE_CAPS = {
  vip1Data: 15, vip1Electricity: 10, vip1Cable: 10, vip1Education: 25, vip1AirtimeToCash: 30,
  vip2Data: 15, vip2Electricity: 10, vip2Cable: 10, vip2Education: 25, vip2AirtimeToCash: 30,
  vip3Data: 15, vip3Electricity: 10, vip3Cable: 10, vip3Education: 25, vip3AirtimeToCash: 30,
} as const;

export async function GET() {
  try {
    await requireAdminApi();
    await db();
    const existing: any = await Settings.findOne({ key: "pricing" }).lean();
    const settings: any = existing || { key: "pricing", rates: {} };
    settings.rates = { ...DEFAULTS, ...VIP_DEFAULTS, ...(existing?.rates || {}) };
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    console.error("ADMIN SETTINGS GET ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unable to load settings" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminApi();
    await db();

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }

    const existing: any = await Settings.findOne({ key: "pricing" }).lean();
    const rates: any = { ...DEFAULTS, ...VIP_DEFAULTS, ...(existing?.rates || {}) };

    for (const key of Object.keys(DEFAULTS)) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (!Number.isFinite(value)) return NextResponse.json({ error: `Invalid value for ${key}` }, { status: 400 });
      if (key === "airtimeRoundUnit") {
        if (value < 1) return NextResponse.json({ error: "Airtime round unit must be at least ₦1" }, { status: 400 });
        rates[key] = value;
        continue;
      }
      try { assertRate(key as RateKey, value); } catch (error: any) {
        return NextResponse.json({ error: error?.message || `Invalid rate for ${key}` }, { status: 400 });
      }
      rates[key] = value;
    }

    for (const key of ["vip1Price", "vip2Price", "vip3Price"] as const) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: `${key} must be greater than ₦0` }, { status: 400 });
      rates[key] = value;
    }

    if (rates.vip2Price <= rates.vip1Price) return NextResponse.json({ error: "VIP 2 price must be greater than VIP 1 price." }, { status: 400 });
    if (rates.vip3Price <= rates.vip2Price) return NextResponse.json({ error: "VIP 3 price must be greater than VIP 2 price." }, { status: 400 });

    for (const key of Object.keys(VIP_RATE_CAPS) as Array<keyof typeof VIP_RATE_CAPS>) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      const max = VIP_RATE_CAPS[key];
      if (!Number.isFinite(value) || value < 0 || value > max) {
        return NextResponse.json({ error: `${key} must be between 0% and ${max}%` }, { status: 400 });
      }
      rates[key] = value;
    }

    const settings = await Settings.findOneAndUpdate(
      { key: "pricing" },
      { $set: { key: "pricing", rates } },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({ success: true, message: "Settings saved successfully", settings });
  } catch (error: unknown) {
    console.error("ADMIN SETTINGS SAVE ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unable to save settings" }, { status });
  }
}
