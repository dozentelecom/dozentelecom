import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const accountNumber = String(
      body.accountNumber || ""
    ).trim();

    const bankCode = String(
      body.bankCode || ""
    ).trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Enter a valid 10-digit account number.",
        },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        {
          error: "Bank code is required.",
        },
        { status: 400 }
      );
    }

    const secret =
      process.env.PAYSTACK_SECRET_KEY || "";

    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Payment service is not configured.",
        },
        { status: 500 }
      );
    }

    const url =
      "https://api.paystack.co/bank/resolve" +
      "?account_number=" +
      encodeURIComponent(accountNumber) +
      "&bank_code=" +
      encodeURIComponent(bankCode);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
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
      return NextResponse.json(
        {
          error:
            "Paystack returned an invalid response.",
        },
        { status: 502 }
      );
    }

    if (!response.ok || !result.status) {
      return NextResponse.json(
        {
          error:
            result.message ||
            "Unable to verify this bank account.",
        },
        {
          status: response.status || 400,
        }
      );
    }

    const data = result.data || {};

    const resolvedAccountNumber = String(
      data.account_number || accountNumber
    ).trim();

    const accountName = String(
      data.account_name || ""
    ).trim();

    if (!accountName) {
      return NextResponse.json(
        {
          error:
            "Unable to retrieve the account name.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      accountNumber: resolvedAccountNumber,
      accountName,
      bankCode,
      bankId: data.bank_id ?? null,
    });
  } catch (error: any) {
    console.error(
      "WITHDRAWAL ACCOUNT VERIFICATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to verify bank account.",
      },
      { status: 500 }
    );
  }
}