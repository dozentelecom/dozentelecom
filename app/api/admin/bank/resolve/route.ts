import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";

export async function POST(req: Request) {
  try {
    await requireAdminApi();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const accountNumber = String(body?.accountNumber || "").replace(/\D/g, "");
    const bankCode = String(body?.bankCode || "").trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json({ error: "Account number must contain exactly 10 digits." }, { status: 400 });
    }
    if (!bankCode) {
      return NextResponse.json({ error: "Bank is required." }, { status: 400 });
    }
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Paystack is not configured." }, { status: 500 });
    }

    const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      cache: "no-store",
    });
    const result = await response.json();

    if (!response.ok || !result.status) {
      return NextResponse.json({ error: result.message || "Unable to verify bank account." }, { status: 400 });
    }

    return NextResponse.json({
      accountNumber: result.data?.account_number || accountNumber,
      accountName: result.data?.account_name || "",
      bankId: result.data?.bank_id || null,
    });
  } catch (error: unknown) {
    console.error("ADMIN BANK RESOLVE ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to verify bank account." },
      { status }
    );
  }
}
