// app/api/pricing/route.ts

import { NextResponse } from "next/server";
import { getRates } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rates = await getRates();

    return NextResponse.json({
      rates: {
        data: Number(rates.data ?? 0),
        electricity: Number(rates.electricity ?? 0),
        cable: Number(rates.cable ?? 0),
        education: Number(rates.education ?? 0),
        airtimeToCash: Number(
          rates.airtimeToCash ?? 0
        ),
        funding: Number(rates.funding ?? 0),
        airtimeRoundUnit: Number(
          rates.airtimeRoundUnit ?? 100
        ),
      },
    });
  } catch (error) {
    console.error("PUBLIC PRICING ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to load pricing",
      },
      {
        status: 500,
      }
    );
  }
}