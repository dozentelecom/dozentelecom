import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function POST(req: Request) {
  try {
    const id = await currentUserId();

    if (!id) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    await db();

    const user: any = await User.findById(id);

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const body = await req.json();

    const accountNumber = String(
      body.accountNumber || ""
    ).replace(/\D/g, "");

    const bankCode = String(
      body.bankCode || ""
    ).trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Account number must contain exactly 10 digits.",
        },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        {
          error: "Bank is required.",
        },
        { status: 400 }
      );
    }

    const url =
      `https://api.paystack.co/bank/resolve` +
      `?account_number=${encodeURIComponent(accountNumber)}` +
      `&bank_code=${encodeURIComponent(bankCode)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}`,
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      return NextResponse.json(
        {
          error:
            result.message ||
            "Unable to verify bank account.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      accountNumber:
        result.data?.account_number ||
        accountNumber,

      accountName:
        result.data?.account_name || "",

      bankId:
        result.data?.bank_id || null,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e?.message ||
          "Unable to verify bank account.",
      },
      { status: 500 }
    );
  }
}