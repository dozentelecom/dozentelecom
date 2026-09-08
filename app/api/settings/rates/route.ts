import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { getRates } from "@/lib/settings";

export async function GET() {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const rates = await getRates();

    return NextResponse.json({
      success: true,
      rates: {
        withdrawal: Number(rates.withdrawal ?? 0),
      },
    });
  } catch (error: any) {
    console.error(
      "CUSTOMER RATES ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load pricing.",
      },
      {
        status: 500,
      }
    );
  }
}