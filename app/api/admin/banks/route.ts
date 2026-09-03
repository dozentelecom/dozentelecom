import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function GET() {
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

    const response = await fetch(
      "https://api.paystack.co/bank?country=nigeria&perPage=100",
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}`,
        },
        cache: "no-store",
      }
    );

    const result = await response.json();

    if (!response.ok || !result.status) {
      return NextResponse.json(
        {
          error:
            result.message ||
            "Unable to load banks",
        },
        { status: 502 }
      );
    }

    const banks = (result.data || [])
      .map((bank: any) => ({
        name: String(bank.name || "").trim(),
        code: String(bank.code || "").trim(),
      }))
      .filter(
        (bank: any) =>
          bank.name && bank.code
      )
      .sort((a: any, b: any) =>
        a.name.localeCompare(b.name)
      );

    return NextResponse.json({
      banks,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e?.message ||
          "Unable to load banks",
      },
      { status: 500 }
    );
  }
}