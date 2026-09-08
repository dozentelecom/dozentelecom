// app/api/pricing/route.ts

import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { getRates } from "@/lib/settings";
import { getVipRate } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await currentUserId();

    await db();

    const user: any = userId
      ? await User.findById(userId)
          .select("vipLevel")
          .lean()
      : null;

    const rates = await getRates();

    const vipLevel = user?.vipLevel || "NORMAL";

    return NextResponse.json({
      rates: {
        data: getVipRate(rates, vipLevel, "data"),

        electricity: getVipRate(
          rates,
          vipLevel,
          "electricity"
        ),

        cable: getVipRate(
          rates,
          vipLevel,
          "cable"
        ),

        education: getVipRate(
          rates,
          vipLevel,
          "education"
        ),

        airtimeToCash: getVipRate(
          rates,
          vipLevel,
          "airtimeToCash"
        ),

        funding: Number(rates.funding ?? 0),

        airtimeRoundUnit: Number(
          rates.airtimeRoundUnit ?? 100
        ),

        withdrawal: Number(
          rates.withdrawal ?? 0
        ),
      },

      vipLevel,
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