import { NextResponse } from "next/server";

import {
  currentUserId,
} from "@/lib/session";

import {
  db,
} from "@/lib/db";

import {
  User,
} from "@/lib/models";

import {
  getProfitSummary,
} from "@/lib/profit";

import {
  paystackGet,
} from "@/lib/paystack";

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const user: any =
    await User.findById(id);

  if (!user || user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

export async function GET() {
  try {
    await requireAdmin();

    const profit =
      await getProfitSummary();

    let paystackBalanceKobo = 0;

    try {
      const balance =
        await paystackGet("/balance");

      const ngn =
        balance?.data?.find(
          (item: any) =>
            item.currency === "NGN"
        );

      paystackBalanceKobo =
        Number(ngn?.balance || 0);
    } catch {
      paystackBalanceKobo = 0;
    }

    return NextResponse.json({
      ...profit,
      paystackBalanceKobo,
      maxWithdrawableKobo:
        Math.min(
          profit.availableProfitKobo,
          paystackBalanceKobo
        ),
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: e.message,
      },
      {
        status:
          e.message === "UNAUTHORIZED"
            ? 401
            : 403,
      }
    );
  }
}