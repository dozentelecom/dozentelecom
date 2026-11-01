import { NextResponse } from "next/server";
import { processFlutterwaveTransaction } from "@/lib/flutterwave-funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const transactionId = String(
    url.searchParams.get("transaction_id") || ""
  );

  const paymentStatus = String(
    url.searchParams.get("status") || ""
  ).toLowerCase();

  if (paymentStatus !== "successful" || !/^\d+$/.test(transactionId)) {
    return NextResponse.redirect(
      new URL("/dashboard?funding=failed", req.url)
    );
  }

  try {
    await processFlutterwaveTransaction(transactionId);

    return NextResponse.redirect(
      new URL("/dashboard?funding=success", req.url)
    );
  } catch (error: any) {
    console.error(
      "Flutterwave funding callback failed:",
      error?.message || "unknown error"
    );

    return NextResponse.redirect(
      new URL("/dashboard?funding=pending", req.url)
    );
  }
}