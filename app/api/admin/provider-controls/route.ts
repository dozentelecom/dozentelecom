import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import { smeapi, arrays } from "@/lib/smeapi";

/* =========================================================
   DEFAULT CONTROLS
   ========================================================= */

const DEFAULT_CONTROLS = {
  sme_networks: {} as Record<string, boolean>,

  sme_service_types: {} as Record<
    string,
    Record<string, boolean>
  >,

  sme_data_plans: {} as Record<string, boolean>,

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
  const userId = await currentUserId();

  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const user = (await User.findById(userId)
  .select("role")
  .lean()
  .exec()) as { role?: string } | null;

if (!user || user.role !== "admin") {
  throw new Error("FORBIDDEN");
}

  if (
  !user ||
  Array.isArray(user) ||
  user.role !== "admin"
) {
  throw new Error("FORBIDDEN");
}

  return user;
}

/* =========================================================
   SME CATALOGUE SYNC
   ========================================================= */

async function syncSmeCatalogue(
  existingRates: any
) {
  const raw = await smeapi.dataPlans();

  const plans = arrays(raw, [
    "data",
    "data_plans",
    "plans",
    "results",
  ]);

  const existingNetworks =
    existingRates?.sme_networks || {};

  const existingServiceTypes =
    existingRates?.sme_service_types || {};

  const existingDataPlans =
    existingRates?.sme_data_plans || {};

  const networks: Record<string, boolean> = {};
  const serviceTypes: Record<
    string,
    Record<string, boolean>
  > = {};
  const dataPlans: Record<string, boolean> = {};

  for (const plan of plans) {
    const networkId = String(
      plan?.network_id ??
        plan?.networkId ??
        ""
    ).trim();

    const serviceType = String(
      plan?.type ??
        plan?.service_type ??
        plan?.serviceType ??
        ""
    ).trim();

    const planId = String(
      plan?.id ??
        plan?.plan_id ??
        plan?.data_plan ??
        ""
    ).trim();

    if (networkId) {
      networks[networkId] =
        existingNetworks[networkId] !== undefined
          ? existingNetworks[networkId]
          : true;
    }

    if (networkId && serviceType) {
      if (!serviceTypes[networkId]) {
        serviceTypes[networkId] = {};
      }

      serviceTypes[networkId][serviceType] =
        existingServiceTypes?.[networkId]?.[
          serviceType
        ] !== undefined
          ? existingServiceTypes[networkId][serviceType]
          : true;
    }

    if (planId) {
      dataPlans[planId] =
        existingDataPlans[planId] !== undefined
          ? existingDataPlans[planId]
          : true;
    }
  }

  return {
    networks,
    serviceTypes,
    dataPlans,
    plans,
  };
}

/* =========================================================
   BUILD CONTROLS
   ========================================================= */

function buildControls(
  savedRates: any,
  catalogue: {
    networks: Record<string, boolean>;
    serviceTypes: Record<
      string,
      Record<string, boolean>
    >;
    dataPlans: Record<string, boolean>;
  }
) {
  return {
    ...DEFAULT_CONTROLS,

    ...savedRates,

    /* =====================================================
       SME NETWORKS

       ONLY networks currently returned by SMEAPI
       are exposed.

       Existing ON/OFF settings are preserved.
       New networks default to ON.
       ===================================================== */

    sme_networks: catalogue.networks,

    /* =====================================================
       SME SERVICE TYPES
       ===================================================== */

    sme_service_types:
      catalogue.serviceTypes,

    /* =====================================================
       SME DATA PLANS
       ===================================================== */

    sme_data_plans:
      catalogue.dataPlans,

    /* =====================================================
       WISESUB
       ===================================================== */

    wisesub_electricity: {
      ...DEFAULT_CONTROLS.wisesub_electricity,
      ...(savedRates.wisesub_electricity || {}),
    },

    wisesub_cable: {
      ...DEFAULT_CONTROLS.wisesub_cable,
      ...(savedRates.wisesub_cable || {}),
    },

    wisesub_education: {
      ...DEFAULT_CONTROLS.wisesub_education,
      ...(savedRates.wisesub_education || {}),
    },
  };
}

/* =========================================================
   GET
   ========================================================= */

export async function GET() {
  try {
    await db();
    await requireAdmin();

    const settings: any =
      await Settings.findOne({
        key: "provider_controls",
      })
        .select("rates")
        .lean();

    const savedRates =
      settings?.rates || {};

    /* -----------------------------------------------------
       GET LIVE SMEAPI CATALOGUE
       ----------------------------------------------------- */

    const catalogue =
      await syncSmeCatalogue(
        savedRates
      );

    /* -----------------------------------------------------
       BUILD SYNCHRONIZED CONTROLS
       ----------------------------------------------------- */

    const controls =
      buildControls(
        savedRates,
        catalogue
      );

    /* -----------------------------------------------------
       SAVE SYNCHRONIZED CATALOGUE
       ----------------------------------------------------- */

    await Settings.findOneAndUpdate(
      {
        key: "provider_controls",
      },
      {
        $set: {
          key: "provider_controls",
          rates: controls,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return NextResponse.json({
      success: true,
      controls,
      catalogue: {
        networks:
          catalogue.networks,
        serviceTypes:
          catalogue.serviceTypes,
        dataPlans:
          catalogue.dataPlans,
      },
    });
  } catch (error: any) {
    console.error(
      "PROVIDER CONTROLS GET ERROR:",
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
          error?.message === "UNAUTHORIZED"
            ? "Unauthorized"
            : error?.message === "FORBIDDEN"
            ? "Forbidden"
            : error?.message ||
              "Unable to load provider controls",
      },
      {
        status,
      }
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
    await db();
    await requireAdmin();

    const body = await req.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid request body",
        },
        {
          status: 400,
        }
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

    /* =====================================================
       VALIDATE GROUPS
       ===================================================== */

    for (const group of allowedGroups) {
      if (body[group] === undefined) {
        continue;
      }

      if (
        typeof body[group] !== "object" ||
        body[group] === null ||
        Array.isArray(body[group])
      ) {
        return NextResponse.json(
          {
            error:
              `Invalid value for ${group}`,
          },
          {
            status: 400,
          }
        );
      }

      /* ---------------------------------------------------
         NESTED SERVICE TYPES
         --------------------------------------------------- */

      if (
        group === "sme_service_types"
      ) {
        updates[group] = {};

        for (const [
          networkId,
          serviceTypes,
        ] of Object.entries(
          body[group]
        )) {
          if (
            typeof serviceTypes !==
              "object" ||
            serviceTypes === null ||
            Array.isArray(serviceTypes)
          ) {
            return NextResponse.json(
              {
                error:
                  `Invalid service types for network ${networkId}`,
              },
              {
                status: 400,
              }
            );
          }

          updates[group][
            String(networkId)
          ] = {};

          for (const [
            serviceType,
            enabled,
          ] of Object.entries(
            serviceTypes as Record<
              string,
              unknown
            >
          )) {
            if (
              typeof enabled !==
              "boolean"
            ) {
              return NextResponse.json(
                {
                  error:
                    `Invalid value for ${group}.${networkId}.${serviceType}`,
                },
                {
                  status: 400,
                }
              );
            }

            updates[group][
              String(networkId)
            ][
              String(serviceType)
            ] = enabled;
          }
        }

        continue;
      }

      /* ---------------------------------------------------
         NORMAL GROUP
         --------------------------------------------------- */

      updates[group] = {};

      for (const [
        code,
        enabled,
      ] of Object.entries(
        body[group]
      )) {
        if (
          typeof enabled !== "boolean"
        ) {
          return NextResponse.json(
            {
              error:
                `Invalid value for ${group}.${code}`,
            },
            {
              status: 400,
            }
          );
        }

        updates[group][
          String(code)
        ] = enabled;
      }
    }

    if (
      Object.keys(updates)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No valid provider controls supplied",
        },
        {
          status: 400,
        }
      );
    }

    /* =====================================================
       LOAD EXISTING
       ===================================================== */

    const existing: any =
      await Settings.findOne({
        key: "provider_controls",
      })
        .select("rates")
        .lean();

    const savedRates =
      existing?.rates || {};

    /* =====================================================
       MERGE
       ===================================================== */

    const newRates: any = {
      ...DEFAULT_CONTROLS,
      ...savedRates,

      sme_networks: {
        ...(savedRates.sme_networks || {}),
        ...(updates.sme_networks || {}),
      },

      sme_service_types: {
        ...(savedRates.sme_service_types || {}),
      },

      sme_data_plans: {
        ...(savedRates.sme_data_plans || {}),
        ...(updates.sme_data_plans || {}),
      },

      wisesub_electricity: {
        ...DEFAULT_CONTROLS.wisesub_electricity,
        ...(savedRates.wisesub_electricity || {}),
        ...(updates.wisesub_electricity || {}),
      },

      wisesub_cable: {
        ...DEFAULT_CONTROLS.wisesub_cable,
        ...(savedRates.wisesub_cable || {}),
        ...(updates.wisesub_cable || {}),
      },

      wisesub_education: {
        ...DEFAULT_CONTROLS.wisesub_education,
        ...(savedRates.wisesub_education || {}),
        ...(updates.wisesub_education || {}),
      },
    };

    /* =====================================================
       MERGE SERVICE TYPES
       ===================================================== */

    for (const [
      networkId,
      serviceTypes,
    ] of Object.entries(
      updates.sme_service_types || {}
    )) {
      newRates.sme_service_types[
        String(networkId)
      ] = {
        ...(savedRates.sme_service_types?.[
          String(networkId)
        ] || {}),

        ...(serviceTypes as Record<
          string,
          boolean
        >),
      };
    }

    /* =====================================================
       SAVE ADMIN CHANGES
       ===================================================== */

    await Settings.findOneAndUpdate(
      {
        key: "provider_controls",
      },
      {
        $set: {
          key: "provider_controls",
          rates: newRates,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    /* =====================================================
       RETURN FRESH SYNCHRONIZED DATA
       ===================================================== */

    const catalogue =
      await syncSmeCatalogue(
        newRates
      );

    const finalControls =
      buildControls(
        newRates,
        catalogue
      );

    await Settings.findOneAndUpdate(
      {
        key: "provider_controls",
      },
      {
        $set: {
          key: "provider_controls",
          rates: finalControls,
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    return NextResponse.json({
      success: true,

      message:
        "Provider controls updated successfully.",

      controls:
        finalControls,

      catalogue: {
        networks:
          catalogue.networks,
        serviceTypes:
          catalogue.serviceTypes,
        dataPlans:
          catalogue.dataPlans,
      },
    });
  } catch (error: any) {
    console.error(
      "PROVIDER CONTROLS PATCH ERROR:",
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
          error?.message === "UNAUTHORIZED"
            ? "Unauthorized"
            : error?.message === "FORBIDDEN"
            ? "Forbidden"
            : error?.message ||
              "Unable to update provider controls",
      },
      {
        status,
      }
    );
  }
}