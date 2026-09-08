import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";

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

    const secret =
      process.env.PAYSTACK_SECRET_KEY || "";

    if (!secret) {
      console.error(
        "PAYSTACK_SECRET_KEY is missing"
      );

      return NextResponse.json(
        {
          error:
            "Payment service is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const response = await fetch(
      "https://api.paystack.co/bank?country=nigeria&currency=NGN&perPage=100",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const text = await response.text();

    let result: any = {};

    try {
      result = text
        ? JSON.parse(text)
        : {};
    } catch {
      return NextResponse.json(
        {
          error:
            "Paystack returned an invalid response.",
        },
        {
          status: 502,
        }
      );
    }

    if (!response.ok || !result.status) {
      return NextResponse.json(
        {
          error:
            result.message ||
            "Unable to load banks.",
        },
        {
          status: response.status || 502,
        }
      );
    }

    const banks = Array.isArray(result.data)
      ? result.data
          .filter(
            (bank: any) =>
              bank?.code &&
              bank?.name
          )
          .map((bank: any) => ({
            id: bank.id,
            name: String(bank.name),
            code: String(bank.code),
            slug: bank.slug || "",
            active:
              bank.active !== false,
            country:
              bank.country || "Nigeria",
            currency:
              bank.currency || "NGN",
          }))
      : [];

    return NextResponse.json({
      success: true,
      banks,
    });
  } catch (error: any) {
    console.error(
      "WITHDRAWAL BANKS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load banks.",
      },
      {
        status: 500,
      }
    );
  }
}
