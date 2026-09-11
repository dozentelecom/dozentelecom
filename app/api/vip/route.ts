import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  User,
  Wallet,
  Settings,
} from "@/lib/models";
import { currentUserId } from "@/lib/session";

type VipLevel =
  | "NORMAL"
  | "VIP1"
  | "VIP2"
  | "VIP3";

const VIP_ORDER: Record<
  VipLevel,
  number
> = {
  NORMAL: 0,
  VIP1: 1,
  VIP2: 2,
  VIP3: 3,
};

export async function GET() {
  try {
    await db();

    const userId =
      await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    /*
     * Cast to any because the current
     * Mongoose User model typing does not
     * expose vipLevel correctly.
     */
    const user =
      (await User.findById(
        userId
      ).lean()) as any;

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found.",
        },
        { status: 404 }
      );
    }

    const currentLevel =
      (user.vipLevel ||
        "NORMAL") as VipLevel;

    /*
     * Make sure an invalid value in the
     * database cannot break the VIP page.
     */
    const safeCurrentLevel =
      VIP_ORDER[currentLevel] !==
      undefined
        ? currentLevel
        : "NORMAL";

    const wallet =
      (await Wallet.findOne({
        userId,
      })
        .select("balanceKobo")
        .lean()) as any;

    const settings =
      (await Settings.findOne({
        key: "pricing",
      }).lean()) as any;

    const rates =
      settings?.rates || {};

    function getPrice(
      level: VipLevel
    ): number {
      if (level === "VIP1") {
        return Number(
          rates.vip1Price || 0
        );
      }

      if (level === "VIP2") {
        return Number(
          rates.vip2Price || 0
        );
      }

      if (level === "VIP3") {
        return Number(
          rates.vip3Price || 0
        );
      }

      return 0;
    }

    /*
     * Keep nextLevel for compatibility with
     * the existing API/page, although the
     * customer page can now select ANY
     * higher VIP level.
     */
    let nextLevel:
      | VipLevel
      | null = null;

    if (
      VIP_ORDER[safeCurrentLevel] < 1
    ) {
      nextLevel = "VIP1";
    } else if (
      VIP_ORDER[safeCurrentLevel] < 2
    ) {
      nextLevel = "VIP2";
    } else if (
      VIP_ORDER[safeCurrentLevel] < 3
    ) {
      nextLevel = "VIP3";
    }

    const currentTotal =
      getPrice(
        safeCurrentLevel
      );

    const targetTotal =
      nextLevel
        ? getPrice(nextLevel)
        : currentTotal;

    const upgradePrice =
      nextLevel
        ? Math.max(
            0,
            targetTotal -
              currentTotal
          )
        : 0;

    const walletBalanceKobo =
      Number(
        wallet?.balanceKobo || 0
      );

    return NextResponse.json({
      success: true,

      vipLevel:
        safeCurrentLevel,

      nextLevel,

      prices: {
        vip1:
          getPrice("VIP1"),

        vip2:
          getPrice("VIP2"),

        vip3:
          getPrice("VIP3"),
      },

      currentTotal,

      targetTotal,

      upgradePrice,

      walletBalanceKobo,

      walletBalanceNaira:
        walletBalanceKobo / 100,
    });
  } catch (error: any) {
    console.error(
      "VIP INFO ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "VIP_INFO_FAILED",
      },
      { status: 500 }
    );
  }
}