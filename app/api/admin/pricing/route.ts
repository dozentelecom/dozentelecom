import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { getRates, saveRates } from "@/lib/settings";

export async function GET() {
  try {
    await requireAdminApi();
    return NextResponse.json({ rates: await getRates() });
  } catch (error: unknown) {
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load pricing" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminApi();
    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON request body" }, { status: 400 });
    }
    return NextResponse.json({ rates: await saveRates(body) });
  } catch (error: unknown) {
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : error instanceof Error ? error.message : "Unable to save pricing" }, { status });
  }
}
