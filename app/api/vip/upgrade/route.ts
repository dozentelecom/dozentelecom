import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { db } from "@/lib/db";
import { User, Settings, Transaction } from "@/lib/models";
import { debitWallet } from "@/lib/ledger";
import { requirePin, jsonAuthError } from "@/lib/authz";

type VipLevel =
  | "NORMAL"
  | "VIP1"
  | "VIP2"
  | "VIP3";

const VIP_ORDER: Record<VipLevel, number> = {
  NORMAL: 0,
  VIP1: 1,
  VIP2: 2,
  VIP3: 3,
};

export async function POST(req: Request) {
  try {
    await db();

    /* =========================================================
       READ REQUEST
       ========================================================= */

    const body = await req.json();

    const pin =
      typeof body?.pin === "string"
        ? body.pin.trim()
        : "";

    const requestedTarget =
      typeof body?.targetLevel === "string"
        ? body.targetLevel.trim().toUpperCase()
        : "";

    /* =========================================================
       REQUIRE PIN
       ========================================================= */

    let authenticatedUser;

    try {
      authenticatedUser =
        await requirePin(pin);
    } catch (error: any) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "PIN verification failed",
        },
        {
          status: jsonAuthError(error),
        }
      );
    }

    const userId =
      String(authenticatedUser._id);

    /* =========================================================
       GET USER
       ========================================================= */

    const user =
      await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const currentLevel: VipLevel =
      user.vipLevel === "VIP1" ||
      user.vipLevel === "VIP2" ||
      user.vipLevel === "VIP3"
        ? user.vipLevel
        : "NORMAL";

    /* =========================================================
       VALIDATE TARGET LEVEL
       ========================================================= */

    if (
      requestedTarget !== "VIP1" &&
      requestedTarget !== "VIP2" &&
      requestedTarget !== "VIP3"
    ) {
      return NextResponse.json(
        {
          error: "INVALID_VIP_LEVEL",
          message:
            "Please select a valid VIP level.",
        },
        {
          status: 400,
        }
      );
    }

    const targetLevel =
      requestedTarget as
        | "VIP1"
        | "VIP2"
        | "VIP3";

    /* =========================================================
       PREVENT DOWNGRADE / SAME LEVEL
       ========================================================= */

    if (
      VIP_ORDER[targetLevel] <=
      VIP_ORDER[currentLevel]
    ) {
      return NextResponse.json(
        {
          error:
            currentLevel === targetLevel
              ? "ALREADY_ON_THIS_LEVEL"
              : "VIP_DOWNGRADE_NOT_ALLOWED",
          message:
            currentLevel === targetLevel
              ? `You are already on ${currentLevel}.`
              : "You can only upgrade to a higher VIP level.",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       GET VIP SETTINGS
       ========================================================= */

    type PricingSettings = {
      rates?: Record<string, any>;
    };

    const settings =
      (await Settings.findOne({
        key: "pricing",
      }).lean()) as
        | PricingSettings
        | null;

    if (!settings) {
      return NextResponse.json(
        {
          error:
            "VIP_SETTINGS_NOT_FOUND",
        },
        {
          status: 500,
        }
      );
    }

    const rates =
      settings.rates || {};

    /* =========================================================
       GET TOTAL PRICE
       ========================================================= */

    function getVipPrice(
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

    const targetPriceNaira =
      getVipPrice(targetLevel);

    const currentPriceNaira =
      getVipPrice(currentLevel);

    /* =========================================================
       VALIDATE TARGET PRICE
       ========================================================= */

    if (
      !Number.isFinite(
        targetPriceNaira
      ) ||
      targetPriceNaira <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "VIP_PRICE_NOT_CONFIGURED",
          message:
            `${targetLevel} upgrade price has not been configured.`,
        },
        {
          status: 400,
        }
      );
    }

    /* =========================================================
       CALCULATE UPGRADE DIFFERENCE
       ========================================================= */

    const upgradePriceNaira =
      targetPriceNaira -
      currentPriceNaira;

    if (
      !Number.isFinite(
        upgradePriceNaira
      ) ||
      upgradePriceNaira <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "INVALID_VIP_PRICING",
          message:
            "VIP prices must increase from one level to the next.",
        },
        {
          status: 400,
        }
      );
    }

    const upgradePriceKobo =
      Math.round(
        upgradePriceNaira * 100
      );

    /* =========================================================
       CREATE UNIQUE REFERENCE
       ========================================================= */

    const reference =
      `VIP-${targetLevel}-${userId}-${randomUUID()}`;

    /* =========================================================
       DEBIT WALLET
       ========================================================= */

    let wallet;

    try {
      wallet =
        await debitWallet(
          userId,
          upgradePriceKobo,
          reference,
          {
            service:
              "VIP_UPGRADE",

            fromLevel:
              currentLevel,

            toLevel:
              targetLevel,

            targetPriceKobo:
              Math.round(
                targetPriceNaira * 100
              ),

            upgradePriceKobo,
          }
        );
    } catch (error: any) {
      if (
        error?.message ===
          "INSUFFICIENT_BALANCE" ||
        /insufficient wallet balance/i.test(
          String(
            error?.message || ""
          )
        )
      ) {
        return NextResponse.json(
          {
            error:
              "INSUFFICIENT_BALANCE",
            message:
              error?.message ||
              "Insufficient wallet balance for this VIP upgrade.",
          },
          {
            status: 400,
          }
        );
      }

      throw error;
    }

    /* =========================================================
       UPDATE VIP LEVEL
       ========================================================= */

    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          vipLevel:
            targetLevel,
        },
      }
    );

    /* =========================================================
       RECORD TRANSACTION
       ========================================================= */

    await Transaction.create({
      userId,

      service:
        "VIP_UPGRADE",

      status:
        "SUCCESS",

      externalReference:
        reference,

      amountKobo:
        upgradePriceKobo,

      costKobo:
        0,

      profitKobo:
        upgradePriceKobo,

      metadata: {
        fromLevel:
          currentLevel,

        toLevel:
          targetLevel,

        targetPriceKobo:
          Math.round(
            targetPriceNaira * 100
          ),

        upgradePriceKobo,
      },
    });

    /* =========================================================
       RESPONSE
       ========================================================= */

    return NextResponse.json({
      success: true,

      message:
        `Successfully upgraded to ${targetLevel}.`,

      vipLevel:
        targetLevel,

      previousLevel:
        currentLevel,

      amountPaidKobo:
        upgradePriceKobo,

      amountPaidNaira:
        upgradePriceNaira,

      balanceKobo:
        wallet.balanceKobo,

      reference,
    });
  } catch (error: any) {
    console.error(
      "VIP UPGRADE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "VIP_UPGRADE_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}