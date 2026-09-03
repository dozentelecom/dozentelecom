import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Settings } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import { User } from "@/lib/models";

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

    let settings: any = await Settings.findOne({
      key: "default"
    }).lean();

    if (!settings) {
      settings = {
        key: "default",
        rates: {
          data: 0,
          electricity: 0,
          cable: 0,
          education: 0,
          airtimeToCash: 0,
          funding: 0,
          airtimeRoundUnit: 100
        }
      };
    }

    return NextResponse.json({
      success: true,
      settings
    });

  } catch (error: any) {
    console.error("ADMIN SETTINGS GET ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to load settings"
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

    const rates = {
      data: Number(body.data ?? 0),
      electricity: Number(body.electricity ?? 0),
      cable: Number(body.cable ?? 0),
      education: Number(body.education ?? 0),
      airtimeToCash: Number(body.airtimeToCash ?? 0),
      funding: Number(body.funding ?? 0),
      airtimeRoundUnit: Number(body.airtimeRoundUnit ?? 100)
    };

    for (const [key, value] of Object.entries(rates)) {
      if (!Number.isFinite(value as number)) {
        return NextResponse.json(
          {
            error: `Invalid value for ${key}`
          },
          { status: 400 }
        );
      }
    }

    const settings = await Settings.findOneAndUpdate(
      { key: "default" },
      {
        $set: {
          key: "default",
          rates
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully",
      settings
    });

  } catch (error: any) {
    console.error("ADMIN SETTINGS SAVE ERROR:", error);

    return NextResponse.json(
      {
        error: "Unable to save settings"
      },
      { status: 500 }
    );
  }
}