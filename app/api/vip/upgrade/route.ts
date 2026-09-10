import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { db } from "@/lib/db";
import { User, Settings, Transaction } from "@/lib/models";
import { debitWallet } from "@/lib/ledger";
import { requirePin, jsonAuthError } from "@/lib/authz";

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

    /* =========================================================
       REQUIRE PIN
       =========================================================
       This happens BEFORE:
       - wallet debit
       - VIP upgrade
       - transaction creation
       ========================================================= */

    let authenticatedUser;

    try {
      authenticatedUser = await requirePin(pin);
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

    const userId = String(authenticatedUser._id);

    /* =========================================================
       GET USER
       ========================================================= */

    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    const currentLevel =
      user.vipLevel || "NORMAL";

    /* =========================================================
       DETERMINE NEXT VIP LEVEL
       ========================================================= */

    let nextLevel:
      | "VIP1"
      | "VIP2"
      | "VIP3";

    switch (currentLevel) {
      case "NORMAL":
        nextLevel = "VIP1";
        break;

      case "VIP1":
        nextLevel = "VIP2";
        break;

      case "VIP2":
        nextLevel = "VIP3";
        break;

      case "VIP3":
        return NextResponse.json(
          {
            error: "ALREADY_MAX_VIP",
            message:
              "You are already on the highest VIP level.",
          },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          {
            error: "INVALID_VIP_LEVEL",
          },
          { status: 400 }
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
      }).lean()) as PricingSettings | null;

    if (!settings) {
      return NextResponse.json(
        {
          error: "VIP_SETTINGS_NOT_FOUND",
        },
        { status: 500 }
      );
    }

    const rates =
      settings?.rates || {};

    /* =========================================================
       GET TOTAL PRICE FOR TARGET LEVEL
       ========================================================= */

    let targetPriceNaira = 0;

    if (nextLevel === "VIP1") {
      targetPriceNaira =
        Number(rates.vip1Price || 0);
    }

    if (nextLevel === "VIP2") {
      targetPriceNaira =
        Number(rates.vip2Price || 0);
    }

    if (nextLevel === "VIP3") {
      targetPriceNaira =
        Number(rates.vip3Price || 0);
    }

    if (
      !Number.isFinite(targetPriceNaira) ||
      targetPriceNaira <= 0
    ) {
      return NextResponse.json(
        {
          error: "VIP_PRICE_NOT_CONFIGURED",
          message:
            `${nextLevel} upgrade price has not been configured.`,
        },
        { status: 400 }
      );
    }

    /* =========================================================
       GET CURRENT LEVEL PRICE
       ========================================================= */

    let currentPriceNaira = 0;

    if (currentLevel === "NORMAL") {
      currentPriceNaira = 0;
    }

    if (currentLevel === "VIP1") {
      currentPriceNaira =
        Number(rates.vip1Price || 0);
    }

    if (currentLevel === "VIP2") {
      currentPriceNaira =
        Number(rates.vip2Price || 0);
    }

    /* =========================================================
       CALCULATE UPGRADE DIFFERENCE
       ========================================================= */

    const upgradePriceNaira =
      targetPriceNaira -
      currentPriceNaira;

    if (upgradePriceNaira <= 0) {
      return NextResponse.json(
        {
          error: "INVALID_VIP_PRICING",
          message:
            "VIP prices must increase from one level to the next.",
        },
        { status: 400 }
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
      `VIP-${nextLevel}-${userId}-${randomUUID()}`;

    /* =========================================================
       DEBIT WALLET
       =========================================================
       PIN HAS ALREADY BEEN VERIFIED ABOVE.
       ========================================================= */

    let wallet;

    try {
      wallet = await debitWallet(
        userId,
        upgradePriceKobo,
        reference,
        {
          service: "VIP_UPGRADE",
          fromLevel: currentLevel,
          toLevel: nextLevel,
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
        "INSUFFICIENT_BALANCE"
      ) {
        return NextResponse.json(
          {
            error:
              "INSUFFICIENT_BALANCE",
            message:
              "Insufficient wallet balance for this VIP upgrade.",
          },
          { status: 400 }
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
          vipLevel: nextLevel,
        },
      }
    );

    /* =========================================================
       RECORD TRANSACTION
       ========================================================= */

    await Transaction.create({
      userId,

      service: "VIP_UPGRADE",

      status: "SUCCESS",

      externalReference: reference,

      amountKobo:
        upgradePriceKobo,

      costKobo: 0,

      profitKobo:
        upgradePriceKobo,

      metadata: {
        fromLevel: currentLevel,
        toLevel: nextLevel,
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
        `Successfully upgraded to ${nextLevel}.`,

      vipLevel: nextLevel,

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
      { status: 500 }
    );
  }
}