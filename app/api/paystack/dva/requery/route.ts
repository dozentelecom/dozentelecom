import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function POST(req: Request) {
  try {
    const id = await currentUserId();

    if (!id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await db();

    const user: any = await User.findById(id).lean();

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        { status: 404 }
      );
    }

    const accountNumber = String(
      user.kyc?.accountNumber || ""
    ).trim();

    if (!accountNumber) {
      return NextResponse.json(
        {
          error:
            "You do not have a dedicated virtual account yet.",
        },
        { status: 400 }
      );
    }

    /*
     * Paystack provider slug.
     */
    const providerSlug =
      String(
        process.env.PAYSTACK_DVA_BANK ||
          "titan-paystack"
      ).trim();

    /*
     * Default to today's date.
     *
     * You can also send:
     *
     * {
     *   "date": "2026-09-08"
     * }
     *
     * if the transfer was made on another date.
     */
    let requestedDate = "";

    try {
      const body = await req.json();

      requestedDate = String(
        body?.date || ""
      ).trim();
    } catch {
      // No body is fine.
    }

    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(
        requestedDate
      )
        ? requestedDate
        : new Intl.DateTimeFormat(
            "en-CA",
            {
              timeZone: "Africa/Lagos",
            }
          ).format(new Date());

    console.log(
      "=== PAYSTACK DVA REQUERY ==="
    );

    console.log({
      userId: String(id),
      accountNumber,
      providerSlug,
      date,
    });

    const url =
      "https://api.paystack.co/dedicated_account/requery" +
      `?account_number=${encodeURIComponent(
        accountNumber
      )}` +
      `&provider_slug=${encodeURIComponent(
        providerSlug
      )}` +
      `&date=${encodeURIComponent(date)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${
            process.env.PAYSTACK_SECRET_KEY || ""
          }`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const text = await response.text();

    let result: any = {};

    try {
      result = text
        ? JSON.parse(text)
        : {};
    } catch {
      console.error(
        "=== PAYSTACK REQUERY INVALID RESPONSE ==="
      );

      console.error(text);

      return NextResponse.json(
        {
          error:
            "Paystack returned an invalid response.",
        },
        { status: 502 }
      );
    }

    console.log(
      "=== PAYSTACK REQUERY RESPONSE ==="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    if (!response.ok || !result.status) {
      return NextResponse.json(
        {
          error:
            result.message ||
            "Paystack requery failed.",
        },
        {
          status:
            response.status >= 400
              ? response.status
              : 502,
        }
      );
    }

    return NextResponse.json({
      success: true,
      accountNumber,
      providerSlug,
      date,
      message:
        result.message ||
        "Paystack is checking the account. If a pending transfer is found, Paystack will send the transaction to your webhook.",
    });
  } catch (error: any) {
    console.error(
      "=== PAYSTACK DVA REQUERY ERROR ==="
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to requery your dedicated account.",
      },
      { status: 500 }
    );
  }
}