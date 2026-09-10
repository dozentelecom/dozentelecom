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

type ServiceKey = (typeof SERVICES)[number];

function isServiceKey(value: string): value is ServiceKey {
  return SERVICES.includes(value as ServiceKey);
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const admin: any = await User.findById(id)
    .select("role name email")
    .lean()
    .exec();

  if (!admin || admin.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return admin;
}

/* =========================================================
   GET SERVICE CONTROLS
========================================================= */

export async function GET() {
  try {
    await requireAdmin();

    const settings: any = await Settings.findOne({
      key: "service_controls",
    })
      .select("rates")
      .lean()
      .exec();

    const saved = settings?.rates || {};

    const services = SERVICES.reduce(
      (result, service) => {
        result[service] =
          typeof saved[service] === "boolean"
            ? saved[service]
            : true;

        return result;
      },
      {} as Record<ServiceKey, boolean>
    );

    return NextResponse.json({
      success: true,
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
        success: false,
        error:
          error?.message ||
          "Unable to load service controls",
      },
      { status }
    );
  }
}

/* =========================================================
   UPDATE SERVICE CONTROL
========================================================= */

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();

    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body",
        },
        { status: 400 }
      );
    }

    const service = String(
      body?.service || ""
    )
      .trim()
      .toLowerCase();

    const enabled = body?.enabled;

    /* -------------------------------------------------------
       VALIDATE SERVICE
    ------------------------------------------------------- */

    if (!isServiceKey(service)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid service",
        },
        { status: 400 }
      );
    }

    /* -------------------------------------------------------
       VALIDATE BOOLEAN
    ------------------------------------------------------- */

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: "enabled must be true or false",
        },
        { status: 400 }
      );
    }

    /* -------------------------------------------------------
       READ PREVIOUS VALUE
    ------------------------------------------------------- */

    const current: any = await Settings.findOne({
      key: "service_controls",
    })
      .select("rates")
      .lean()
      .exec();

    const previousValue =
      typeof current?.rates?.[service] === "boolean"
        ? current.rates[service]
        : true;

    /* -------------------------------------------------------
       ATOMIC UPDATE
       
       Only the selected service is changed.
       Other service controls remain untouched.
    ------------------------------------------------------- */

    await Settings.findOneAndUpdate(
      {
        key: "service_controls",
      },
      {
        $set: {
          [`rates.${service}`]: enabled,
        },
        $setOnInsert: {
          key: "service_controls",
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    ).exec();

    /* -------------------------------------------------------
       READ BACK FROM DATABASE
       
       This confirms the value was actually persisted.
    ------------------------------------------------------- */

    const saved: any = await Settings.findOne({
      key: "service_controls",
    })
      .select("rates")
      .lean()
      .exec();

    const persistedValue =
      typeof saved?.rates?.[service] === "boolean"
        ? saved.rates[service]
        : true;

    console.log(
      `ADMIN SERVICE CONTROL: ${admin._id} changed ${service} from ${previousValue} to ${enabled}. Persisted: ${persistedValue}`
    );

    return NextResponse.json({
      success: true,
      message: "Service control updated successfully",
      service,
      enabled: persistedValue,
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
        success: false,
        error:
          error?.message ||
          "Unable to update service",
      },
      { status }
    );
  }
}