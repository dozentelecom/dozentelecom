import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Settings, User } from "@/lib/models";
import { currentUserId } from "@/lib/session";

import {
  DEFAULTS,
  assertRate,
  RateKey,
} from "@/lib/pricing";

/* =========================================================
   ADMIN AUTH
   ========================================================= */

async function requireAdminApi() {
  const id = await currentUserId();

  if (!id) {
    return null;
  }

  await db();

  const user: any =
    await User.findById(id).lean();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

/* =========================================================
   DEFAULT VIP SETTINGS
   ========================================================= */

const VIP_DEFAULTS = {
  /* VIP MEMBERSHIP PRICES */

  vip1Price: 5000,
  vip2Price: 15000,
  vip3Price: 30000,

  /* VIP1 SERVICE RATES */

  vip1Data: 4,
  vip1Electricity: 3,
  vip1Cable: 3,
  vip1Education: 12,
  vip1AirtimeToCash: 18,

  /* VIP2 SERVICE RATES */

  vip2Data: 3,
  vip2Electricity: 2,
  vip2Cable: 2,
  vip2Education: 10,
  vip2AirtimeToCash: 15,

  /* VIP3 SERVICE RATES */

  vip3Data: 2,
  vip3Electricity: 1,
  vip3Cable: 1,
  vip3Education: 8,
  vip3AirtimeToCash: 12,
};

/* =========================================================
   VIP SERVICE RATE CAPS
   ========================================================= */

const VIP_RATE_CAPS = {
  vip1Data: 15,
  vip1Electricity: 10,
  vip1Cable: 10,
  vip1Education: 25,
  vip1AirtimeToCash: 30,

  vip2Data: 15,
  vip2Electricity: 10,
  vip2Cable: 10,
  vip2Education: 25,
  vip2AirtimeToCash: 30,

  vip3Data: 15,
  vip3Electricity: 10,
  vip3Cable: 10,
  vip3Education: 25,
  vip3AirtimeToCash: 30,
} as const;

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  try {
    const admin =
      await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const existingSettings: any =
      await Settings.findOne({
        key: "pricing",
      }).lean();

    /*
     * Merge defaults with existing
     * database values.
     *
     * This is important because old
     * settings documents may not yet
     * contain the VIP fields.
     */

    const settings: any =
      existingSettings || {
        key: "pricing",
        rates: {},
      };

    settings.rates = {
      ...DEFAULTS,
      ...VIP_DEFAULTS,
      ...(existingSettings?.rates || {}),
    };

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error(
      "ADMIN SETTINGS GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load settings",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   ========================================================= */

export async function POST(
  req: Request
) {
  try {
    const admin =
      await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await req.json();

    /*
     * Load existing settings first.
     *
     * This prevents saving the admin form
     * from accidentally deleting VIP fields
     * that were already stored.
     */

    const existingSettings: any =
      await Settings.findOne({
        key: "pricing",
      }).lean();

    const rates: any = {
      ...DEFAULTS,
      ...VIP_DEFAULTS,
      ...(existingSettings?.rates || {}),
    };

    /* =======================================================
       NORMAL SERVICE RATES
       ======================================================= */

    for (
      const key of Object.keys(DEFAULTS)
    ) {
      if (body[key] === undefined) {
        continue;
      }

      const value = Number(
        body[key]
      );

      if (!Number.isFinite(value)) {
        return NextResponse.json(
          {
            error:
              `Invalid value for ${key}`,
          },
          {
            status: 400,
          }
        );
      }

      /* -----------------------------------------
         AIRTIME ROUND UNIT
         ----------------------------------------- */

      if (
        key === "airtimeRoundUnit"
      ) {
        if (value < 1) {
          return NextResponse.json(
            {
              error:
                "Airtime round unit must be at least ₦1",
            },
            {
              status: 400,
            }
          );
        }

        rates[key] = value;

        continue;
      }

      /* -----------------------------------------
         NORMAL RATE VALIDATION
         ----------------------------------------- */

      try {
        assertRate(
          key as RateKey,
          value
        );
      } catch (error: any) {
        return NextResponse.json(
          {
            error:
              error?.message ||
              `Invalid rate for ${key}`,
          },
          {
            status: 400,
          }
        );
      }

      rates[key] = value;
    }

    /* =======================================================
       VIP MEMBERSHIP PRICES
       ======================================================= */

    const vipPrices = [
      "vip1Price",
      "vip2Price",
      "vip3Price",
    ] as const;

    for (const key of vipPrices) {
      if (body[key] === undefined) {
        continue;
      }

      const value = Number(
        body[key]
      );

      if (
        !Number.isFinite(value) ||
        value <= 0
      ) {
        return NextResponse.json(
          {
            error:
              `${key} must be greater than ₦0`,
          },
          {
            status: 400,
          }
        );
      }

      rates[key] = value;
    }

    /* =======================================================
       VIP MEMBERSHIP PRICE ORDER
       ======================================================= */

    if (
      rates.vip2Price <=
      rates.vip1Price
    ) {
      return NextResponse.json(
        {
          error:
            "VIP 2 price must be greater than VIP 1 price.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      rates.vip3Price <=
      rates.vip2Price
    ) {
      return NextResponse.json(
        {
          error:
            "VIP 3 price must be greater than VIP 2 price.",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       VIP SERVICE RATES
       ======================================================= */

    for (
      const key of Object.keys(
        VIP_RATE_CAPS
      ) as Array<
        keyof typeof VIP_RATE_CAPS
      >
    ) {
      if (body[key] === undefined) {
        continue;
      }

      const value = Number(
        body[key]
      );

      const max =
        VIP_RATE_CAPS[key];

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > max
      ) {
        return NextResponse.json(
          {
            error:
              `${key} must be between 0% and ${max}%`,
          },
          {
            status: 400,
          }
        );
      }

      rates[key] = value;
    }

    /* =======================================================
       SAVE
       ======================================================= */

    await db();

    const settings =
      await Settings.findOneAndUpdate(
        {
          key: "pricing",
        },
        {
          $set: {
            key: "pricing",
            rates,
          },
        },
        {
          new: true,
          upsert: true,
        }
      ).lean();

    return NextResponse.json({
      success: true,

      message:
        "Settings saved successfully",

      settings,
    });
  } catch (error: any) {
    console.error(
      "ADMIN SETTINGS SAVE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to save settings",
      },
      {
        status: 500,
      }
    );
  }
}