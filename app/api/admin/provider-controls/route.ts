import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import { smeapi } from "@/lib/smeapi";

type Controls = {
  sme_networks: Record<string, boolean>;
  sme_service_types: Record<string, Record<string, boolean>>;
  sme_data_plans: Record<string, boolean>;
  wisesub_electricity: Record<string, boolean>;
  wisesub_cable: Record<string, boolean>;
  wisesub_education: Record<string, boolean>;
};

const DEFAULT_CONTROLS: Controls = {
  sme_networks: {},
  sme_service_types: {},
  sme_data_plans: {},

  wisesub_electricity: {
    abuja: true,
    ikeja: true,
    eko: true,
    kano: true,
    portharcourt: true,
    jos: true,
    ibadan: true,
    kaduna: true,
    benin: true,
    aba: true,
    enugu: true,
    yola: true,
  },

  wisesub_cable: {
    dstv: true,
    gotv: true,
    startimes: true,
  },

  wisesub_education: {
    "result-checker": true,
    registration: true,
  },
};

/* =========================================================
   ADMIN CHECK
========================================================= */

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  /*
   * Explicitly type this as a single document.
   *
   * Mongoose's inferred lean() type can sometimes produce
   * a document | document[] union, even though findById()
   * returns one document or null.
   */
  const user = (await User.findById(id)
    .select("role")
    .lean()
    .exec()) as { role?: string } | null;

  if (!user || user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return user;
}

/* =========================================================
   HELPERS
========================================================= */

function asObject(value: any): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function arrays(raw: any, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(raw?.[key])) {
      return raw[key];
    }
  }

  return [];
}

/* =========================================================
   SYNC SME CATALOGUE
========================================================= */

async function syncSmeCatalogue(existingRates: any) {
  const existing = asObject(existingRates);

  const existingNetworks = asObject(existing.sme_networks);
  const existingServiceTypes = asObject(
    existing.sme_service_types
  );
  const existingDataPlans = asObject(
    existing.sme_data_plans
  );

  try {
    const raw = await smeapi.dataPlans();

    const plans = arrays(raw, [
      "data",
      "data_plans",
      "plans",
      "results",
    ]);

    const networks: Record<string, boolean> = {
      ...existingNetworks,
    };

    const serviceTypes: Record<
      string,
      Record<string, boolean>
    > = {
      ...existingServiceTypes,
    };

    const dataPlans: Record<string, boolean> = {
      ...existingDataPlans,
    };

    for (const plan of plans) {
      if (!plan) continue;

      const networkId =
        plan.network_id ??
        plan.networkId ??
        plan.network;

      const networkName =
        plan.network ??
        plan.network_name ??
        String(networkId ?? "");

      if (
        networkId !== undefined &&
        networkId !== null
      ) {
        const networkKey = String(networkId);

        if (!(networkKey in networks)) {
          networks[networkKey] = true;
        }

        if (!serviceTypes[networkKey]) {
          serviceTypes[networkKey] = {};
        }

        const serviceType =
          plan.type ??
          plan.plan_type ??
          plan.service_type;

        if (serviceType) {
          const typeKey = String(serviceType);

          if (
            !(typeKey in serviceTypes[networkKey])
          ) {
            serviceTypes[networkKey][typeKey] = true;
          }
        }
      }

      const planId =
        plan.id ??
        plan.plan_id ??
        plan.planId;

      if (
        planId !== undefined &&
        planId !== null
      ) {
        const planKey = String(planId);

        if (!(planKey in dataPlans)) {
          dataPlans[planKey] = true;
        }
      }

      void networkName;
    }

    return {
      sme_networks: networks,
      sme_service_types: serviceTypes,
      sme_data_plans: dataPlans,
    };
  } catch {
    return {
      sme_networks: existingNetworks,
      sme_service_types: existingServiceTypes,
      sme_data_plans: existingDataPlans,
    };
  }
}

/* =========================================================
   BUILD CONTROLS
========================================================= */

function buildControls(
  savedRates: any,
  catalogue: any
): Controls {
  const saved = asObject(savedRates);
  const catalog = asObject(catalogue);

  return {
    sme_networks: {
      ...DEFAULT_CONTROLS.sme_networks,
      ...asObject(saved.sme_networks),
      ...asObject(catalog.sme_networks),
    },

    sme_service_types: {
      ...DEFAULT_CONTROLS.sme_service_types,
      ...asObject(saved.sme_service_types),
      ...asObject(catalog.sme_service_types),
    },

    sme_data_plans: {
      ...DEFAULT_CONTROLS.sme_data_plans,
      ...asObject(saved.sme_data_plans),
      ...asObject(catalog.sme_data_plans),
    },

    wisesub_electricity: {
      ...DEFAULT_CONTROLS.wisesub_electricity,
      ...asObject(saved.wisesub_electricity),
    },

    wisesub_cable: {
      ...DEFAULT_CONTROLS.wisesub_cable,
      ...asObject(saved.wisesub_cable),
    },

    wisesub_education: {
      ...DEFAULT_CONTROLS.wisesub_education,
      ...asObject(saved.wisesub_education),
    },
  };
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  try {
    await requireAdmin();
    await db();

    const settings: any =
      await Settings.findOne({
        key: "provider_controls",
      })
        .select("rates")
        .lean()
        .exec();

    const savedRates =
      asObject(settings?.rates);

    const catalogue =
      await syncSmeCatalogue(
        savedRates
      );

    const controls =
      buildControls(
        savedRates,
        catalogue
      );

    /*
     * IMPORTANT:
     * Do not overwrite the database during GET.
     *
     * GET only returns the current controls.
     * This prevents page refreshes from accidentally
     * resetting provider settings.
     */

    return NextResponse.json({
      success: true,
      controls,
    });
  } catch (error: any) {
    console.error(
      "GET /api/admin/provider-controls:",
      error
    );

    const message =
      error?.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : error?.message === "FORBIDDEN"
        ? "Forbidden"
        : "Failed to load provider controls";

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}

/* =========================================================
   PATCH
========================================================= */

export async function PATCH(
  req: Request
) {
  try {
    await requireAdmin();
    await db();

    const body =
      await req.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid request body",
        },
        { status: 400 }
      );
    }

    const allowedGroups = [
      "sme_networks",
      "sme_service_types",
      "sme_data_plans",
      "wisesub_electricity",
      "wisesub_cable",
      "wisesub_education",
    ];

    const updates: Record<
      string,
      any
    > = {};

    for (
      const group of allowedGroups
    ) {
      if (
        body[group] &&
        typeof body[group] ===
          "object" &&
        !Array.isArray(
          body[group]
        )
      ) {
        updates[group] =
          body[group];
      }
    }

    if (
      Object.keys(updates)
        .length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid provider-control update supplied",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * ATOMIC UPDATES
     *
     * Instead of replacing the entire rates object,
     * update only the exact provider setting requested.
     * -------------------------------------------------------
     */

    const setOperations: Record<
      string,
      any
    > = {};

    for (
      const [
        group,
        values,
      ] of Object.entries(updates)
    ) {
      for (
        const [
          code,
          value,
        ] of Object.entries(
          values
        )) {
        if (
          typeof value ===
          "boolean"
        ) {
          setOperations[
            `rates.${group}.${code}`
          ] = value;
        } else if (
          group ===
            "sme_service_types" &&
          value &&
          typeof value ===
            "object" &&
          !Array.isArray(value)
        ) {
          for (
            const [
              serviceType,
              enabled,
            ] of Object.entries(
              value as Record<
                string,
                any
              >
            )
          ) {
            if (
              typeof enabled ===
              "boolean"
            ) {
              setOperations[
                `rates.${group}.${code}.${serviceType}`
              ] = enabled;
            }
          }
        }
      }
    }

    if (
      Object.keys(
        setOperations
      ).length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid boolean provider-control values supplied",
        },
        { status: 400 }
      );
    }

    await Settings.findOneAndUpdate(
      {
        key:
          "provider_controls",
      },
      {
        $set:
          setOperations,

        $setOnInsert: {
          key:
            "provider_controls",
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert:
          true,
      }
    ).exec();

    /* -------------------------------------------------------
       READ BACK FROM DATABASE
       ------------------------------------------------------- */

    const saved: any =
      await Settings.findOne({
        key:
          "provider_controls",
      })
        .select("rates")
        .lean()
        .exec();

    const savedRates =
      asObject(saved?.rates);

    const catalogue =
      await syncSmeCatalogue(
        savedRates
      );

    const controls =
      buildControls(
        savedRates,
        catalogue
      );

    return NextResponse.json({
      success: true,
      message:
        "Provider settings updated successfully",
      controls,
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/admin/provider-controls:",
      error
    );

    const message =
      error?.message === "UNAUTHORIZED"
        ? "Unauthorized"
        : error?.message === "FORBIDDEN"
        ? "Forbidden"
        : "Failed to update provider controls";

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}