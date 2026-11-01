import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  // Intentionally does not create a second wallet/refund system.
  // Map request-id to your existing Transaction and then call
  // completeServiceTransaction/failServiceTransaction in your existing
  // transaction workflow.
  const requestId = body?.["request-id"];

  return NextResponse.json({
    success: true,
    received: true,
    requestId: requestId || null,
  });
}
