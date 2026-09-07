import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getRates } from "@/lib/settings";

export async function GET() {
  try {
    await requireUser();

    const rates = await getRates();

    return NextResponse.json({
      success: true,
      pricing: {
        dataMarkup: Number(rates.data || 0),
        airtimeRoundUnit: Math.max(
          1,
          Number(rates.airtimeRoundUnit || 10)
        ),
      },
    });
  } catch (e: any) {
    const status =
      e?.message === "UNAUTHORIZED"
        ? 401
        : 400;

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Unable to load pricing",
      },
      { status }
    );
  }
}