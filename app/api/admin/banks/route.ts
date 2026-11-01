import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApi();

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack is not configured." }, { status: 500 });
    }

    const response = await fetch("https://api.paystack.co/bank?country=nigeria&perPage=100", {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || !result.status) {
      return NextResponse.json({ error: result.message || "Unable to load banks" }, { status: 502 });
    }

    const banks = (result.data || [])
      .map((bank: any) => ({ name: String(bank.name || "").trim(), code: String(bank.code || "").trim() }))
      .filter((bank: any) => bank.name && bank.code)
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ banks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    console.error("ADMIN BANKS ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load banks" },
      { status }
    );
  }
}
