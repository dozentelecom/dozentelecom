import { NextResponse } from "next/server";
import { processFlutterwaveTransaction } from "@/lib/flutterwave-funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "flutterwave",
    route: "webhook",
  });
}

export async function POST(req: Request) {
  const expectedHash = process.env.FLW_WEBHOOK_SECRET_HASH;
  const receivedHash = req.headers.get("verif-hash");

  if (!expectedHash || !receivedHash || receivedHash !== expectedHash) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 }
    );
  }

  try {
    const event: any = await req.json();
    const data = event?.data || {};

    if (event?.event !== "charge.completed" || !data?.id) {
      return NextResponse.json({ ok: true });
    }

    const transactionId = String(data.id);

    if (!/^\d+$/.test(transactionId)) {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    await processFlutterwaveTransaction(transactionId);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error(
      "Flutterwave webhook processing error:",
      error?.message || "unknown error"
    );

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}