```ts
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Settings, User } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import {
  DEFAULTS,
  assertRate,
  RateKey,
} from "@/lib/pricing";

async function requireAdminApi() {
  const id = await currentUserId();

  if (!id) {
    return null;
  }

  await db();

  const user: any = await User.findById(id).lean();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const admin = await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const settings: any =
      (await Settings.findOne({
        key: "pricing",
      }).lean()) || {
        key: "pricing",
        rates: {
          ...DEFAULTS,
        },
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
        error: "Unable to load settings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const rates: any = {
      ...DEFAULTS,
    };

    for (
      const key of Object.keys(DEFAULTS)
    ) {
      if (body[key] === undefined) {
        continue;
      }

      const value = Number(body[key]);

      if (!Number.isFinite(value)) {
        return NextResponse.json(
          {
            error: `Invalid value for ${key}`,
          },
          { status: 400 }
        );
      }

      if (key === "airtimeRoundUnit") {
        if (value < 1) {
          return NextResponse.json(
            {
              error:
                "Airtime round unit must be at least ₦1",
            },
            { status: 400 }
          );
        }

        rates[key] = value;
        continue;
      }

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
          { status: 400 }
        );
      }

      rates[key] = value;
    }

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
      );

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
      { status: 500 }
    );
  }
}
```
