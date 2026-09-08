import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";

export const dynamic = "force-dynamic";

const SERVICES = [
  "data",
  "airtime",
  "electricity",
  "cable",
  "education",
] as const;

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const admin: any =
    await User.findById(id)
      .select("role name email")
      .lean();

  if (!admin || admin.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return admin;
}

export async function GET() {
  try {
    await requireAdmin();

    const settings: any =
      await Settings.findOne({
        key: "service_controls",
      }).lean();

    const saved =
      settings?.rates || {};

    const services = SERVICES.reduce(
      (result, service) => {
        result[service] =
          saved[service] !== undefined
            ? Boolean(saved[service])
            : true;

        return result;
      },
      {} as Record<string, boolean>
    );

    return NextResponse.json({
      services,
    });
  } catch (error: any) {
    console.error(
      "SERVICE CONTROLS GET ERROR:",
      error
    );

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load service controls",
      },
      { status }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();

    const body = await req.json();

    const service = String(
      body?.service || ""
    ).toLowerCase();

    const enabled = body?.enabled;

    if (!SERVICES.includes(service as any)) {
      return NextResponse.json(
        {
          error: "Invalid service",
        },
        { status: 400 }
      );
    }

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        {
          error:
            "enabled must be true or false",
        },
        { status: 400 }
      );
    }

    const current: any =
      await Settings.findOne({
        key: "service_controls",
      }).lean();

    const previousValue =
      current?.rates?.[service] ??
      true;

    const rates = {
      ...(current?.rates || {}),
      [service]: enabled,
    };

    await Settings.findOneAndUpdate(
      {
        key: "service_controls",
      },
      {
        key: "service_controls",
        rates,
      },
      {
        upsert: true,
        new: true,
      }
    );

    console.log(
      `ADMIN SERVICE CONTROL: ${admin._id} changed ${service} from ${previousValue} to ${enabled}`
    );

    return NextResponse.json({
      success: true,
      service,
      enabled,
      previousValue,
    });
  } catch (error: any) {
    console.error(
      "SERVICE CONTROLS PATCH ERROR:",
      error
    );

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to update service",
      },
      { status }
    );
  }
}