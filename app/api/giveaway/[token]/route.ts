import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Giveaway } from "@/lib/models";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await db();

    const { token: rawToken } = await params;
const token = String(rawToken || "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Invalid giveaway link" },
        { status: 400 }
      );
    }

    const giveaway: any = await Giveaway.findOne({ token }).lean();

    if (!giveaway) {
      return NextResponse.json(
        { error: "Giveaway not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    const expired =
      giveaway.expiresAt &&
      new Date(giveaway.expiresAt).getTime() <= now.getTime();

    const limitReached =
      Number(giveaway.claimedCount || 0) >=
      Number(giveaway.recipientLimit || 0);

    const active =
      giveaway.status === "ACTIVE" &&
      !expired &&
      !limitReached;

    const remaining = Math.max(
      0,
      Number(giveaway.recipientLimit || 0) -
        Number(giveaway.claimedCount || 0)
    );

    return NextResponse.json({
      giveaway: {
        token: giveaway.token,
        type: giveaway.type,
        network: giveaway.network,

        amount:
          giveaway.type === "AIRTIME"
            ? Number(giveaway.rewardPriceKobo || 0) / 100
            : undefined,

        dataPlanId: giveaway.dataPlanId || undefined,
        dataPlanName: giveaway.dataPlanName || undefined,

        recipientLimit: Number(giveaway.recipientLimit || 0),
        claimedCount: Number(giveaway.claimedCount || 0),
        remaining,

        expiresAt: giveaway.expiresAt || null,

        status: active ? "ACTIVE" : "INACTIVE",
        active,
      },
    });
  } catch (error: any) {
    console.error("GIVEAWAY INFO ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to load giveaway",
      },
      { status: 500 }
    );
  }
}