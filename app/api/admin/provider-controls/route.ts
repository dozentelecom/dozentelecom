import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/requireAdminApi";

import { db } from "@/lib/db";
import { User, Settings } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import { smeapi } from "@/lib/smeapi";
import { loadLegitdatawayDataPlans } from "@/lib/providers/legitdataway";


/* =========================================================
   TYPES
========================================================= */

/*
 * data_providers:
 *
 * This is the CURRENT provider selected for each network.
 *
 * Example:
 *
 * {
 *   "1": "SMEAPI",
 *   "2": "LEGITDATAWAY",
 *   "3": "SMEAPI",
 *   "4": "LEGITDATAWAY"
 * }
 *
 * IMPORTANT:
 * This is NOT automatic failover.
 *
 * If MTN is set to LEGITDATAWAY, MTN uses
 * LEGITDATAWAY until an admin changes it.
 */
type Controls = {
  data_providers: Record<string, string>;

  /*
   * Provider availability.
   *
   * This allows us to disable a provider without
   * changing the network mapping.
   */
  data_provider_enabled: Record<string, boolean>;

  /*
   * Existing SME controls are preserved for compatibility.
   */
  sme_networks: Record<string, boolean>;
  sme_service_types: Record<
    string,
    Record<string, boolean>
  >;
  sme_data_plans: Record<string, boolean>;

};

/* =========================================================
   REGISTERED DATA PROVIDERS
========================================================= */

/*
 * Add future providers here when their adapter is created.
 *
 * Example later:
 *
 * "BIGISUB"
 * "VTUNAIJA"
 *
 * The provider-control system itself does NOT permanently
 * assign a provider to a network.
 *
 * Admin can map any network to any registered provider.
 */
const DATA_PROVIDERS = [
  "SMEAPI",
  "LEGITDATAWAY",
] as const;

type DataProvider =
  (typeof DATA_PROVIDERS)[number];

/* =========================================================
   DEFAULT CONTROLS
========================================================= */

const DEFAULT_CONTROLS: Controls = {
  /*
   * Default all currently supported networks to SMEAPI
   * so the existing website continues working until the
   * admin intentionally switches a network.
   */
  data_providers: {
    "1": "SMEAPI", // MTN
    "2": "SMEAPI", // Airtel
    "3": "SMEAPI", // Glo
    "4": "SMEAPI", // 9mobile
  },

  /*
   * Both currently integrated providers are enabled by
   * default.
   */
  data_provider_enabled: {
    SMEAPI: true,
    LEGITDATAWAY: true,
  },

  sme_networks: {},

  sme_service_types: {},

  sme_data_plans: {},

};

/* =========================================================
   ADMIN CHECK
========================================================= */

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

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

function asObject(
  value: any
): Record<string, any> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value;
}

function arrays(
  raw: any,
  keys: string[]
) {
  for (const key of keys) {
    if (Array.isArray(raw?.[key])) {
      return raw[key];
    }
  }

  return [];
}

/* =========================================================
   NORMALIZE PROVIDER NAME
========================================================= */

function normalizeProvider(
  value: unknown
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/* =========================================================
   VALID PROVIDER CHECK
========================================================= */

function isRegisteredDataProvider(
  provider: string
): provider is DataProvider {
  return (
    DATA_PROVIDERS as readonly string[]
  ).includes(provider);
}

/* =========================================================
   SYNC SME CATALOGUE
========================================================= */

async function syncSmeCatalogue(
  existingRates: any
) {
  const existing =
    asObject(existingRates);

  const existingNetworks =
    asObject(
      existing.sme_networks
    );

  const existingServiceTypes =
    asObject(
      existing.sme_service_types
    );

  const existingDataPlans =
    asObject(
      existing.sme_data_plans
    );

  try {
    const raw =
      await smeapi.dataPlans();

    const plans = arrays(raw, [
      "data",
      "data_plans",
      "plans",
      "results",
    ]);

    const networks: Record<
      string,
      boolean
    > = {
      ...existingNetworks,
    };

    const serviceTypes: Record<
      string,
      Record<string, boolean>
    > = {
      ...existingServiceTypes,
    };

    const dataPlans: Record<
      string,
      boolean
    > = {
      ...existingDataPlans,
    };

    for (const plan of plans) {
      if (!plan) continue;

      const networkId =
        plan.network_id ??
        plan.networkId ??
        plan.network;

      if (
        networkId !== undefined &&
        networkId !== null
      ) {
        const networkKey =
          String(networkId);

        if (
          !(networkKey in networks)
        ) {
          networks[networkKey] =
            true;
        }

        if (
          !serviceTypes[
            networkKey
          ]
        ) {
          serviceTypes[
            networkKey
          ] = {};
        }

        const serviceType =
          plan.type ??
          plan.plan_type ??
          plan.service_type;

        if (serviceType) {
          const typeKey =
            String(serviceType);

          if (
            !(
              typeKey in
              serviceTypes[
                networkKey
              ]
            )
          ) {
            serviceTypes[
              networkKey
            ][typeKey] = true;
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
        const planKey =
          String(planId);

        if (
          !(planKey in dataPlans)
        ) {
          dataPlans[
            planKey
          ] = true;
        }
      }
    }

    return {
      sme_networks:
        networks,

      sme_service_types:
        serviceTypes,

      sme_data_plans:
        dataPlans,
    };
  } catch {
    return {
      sme_networks:
        existingNetworks,

      sme_service_types:
        existingServiceTypes,

      sme_data_plans:
        existingDataPlans,
    };
  }
}

/* =========================================================
   BUILD DATA PROVIDER CONTROLS
========================================================= */

function buildDataProviderControls(
  savedRates: any
) {
  const saved =
    asObject(savedRates);

  const savedProviders =
    asObject(
      saved.data_providers
    );

  const savedEnabled =
    asObject(
      saved.data_provider_enabled
    );

  /*
   * IMPORTANT:
   *
   * Existing saved provider mappings win.
   *
   * Therefore changing this file later will NOT
   * silently change the admin's current provider
   * selections.
   */
  const dataProviders: Record<
    string,
    string
  > = {
    ...DEFAULT_CONTROLS.data_providers,
    ...savedProviders,
  };

  /*
   * Remove invalid provider mappings.
   *
   * We do not allow the admin to select a provider
   * that has no adapter registered yet.
   */
  for (const [
    network,
    providerValue,
  ] of Object.entries(
    dataProviders
  )) {
    const provider =
      normalizeProvider(
        providerValue
      );

    if (
      !isRegisteredDataProvider(
        provider
      )
    ) {
      /*
       * Preserve a safe working provider.
       *
       * Existing unknown values are not allowed to
       * break the data purchase system.
       */
      dataProviders[
        network
      ] =
        DEFAULT_CONTROLS
          .data_providers[
          network
        ] ||
        "SMEAPI";
    } else {
      dataProviders[
        network
      ] = provider;
    }
  }

  const dataProviderEnabled: Record<
    string,
    boolean
  > = {
    ...DEFAULT_CONTROLS.data_provider_enabled,
    ...savedEnabled,
  };

  /*
   * Make sure every registered provider has an
   * explicit enabled/disabled state.
   */
  for (const provider of DATA_PROVIDERS) {
    if (
      typeof dataProviderEnabled[
        provider
      ] !== "boolean"
    ) {
      dataProviderEnabled[
        provider
      ] = true;
    }
  }

  return {
    data_providers:
      dataProviders,

    data_provider_enabled:
      dataProviderEnabled,
  };
}

/* =========================================================
   BUILD CONTROLS
========================================================= */

function buildControls(
  savedRates: any,
  catalogue: any
): Controls {
  const saved =
    asObject(savedRates);

  const catalog =
    asObject(catalogue);

  const dataProviderControls =
    buildDataProviderControls(
      saved
    );

  return {
    /*
     * NEW GENERIC PROVIDER SELECTION
     */
    data_providers:
      dataProviderControls
        .data_providers,

    data_provider_enabled:
      dataProviderControls
        .data_provider_enabled,

    /*
     * EXISTING SME CONTROLS
     */
    sme_networks: {
      ...DEFAULT_CONTROLS.sme_networks,

      ...asObject(
        catalog.sme_networks
      ),

      ...asObject(
        saved.sme_networks
      ),
    },

    sme_service_types: {
      ...DEFAULT_CONTROLS
        .sme_service_types,

      ...asObject(
        catalog.sme_service_types
      ),

      ...asObject(
        saved.sme_service_types
      ),
    },

    sme_data_plans: {
      ...DEFAULT_CONTROLS
        .sme_data_plans,

      ...asObject(
        catalog.sme_data_plans
      ),

      ...asObject(
        saved.sme_data_plans
      ),
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
        key:
          "provider_controls",
      })
        .select("rates")
        .lean()
        .exec();

    const savedRates =
      asObject(
        settings?.rates
      );

    /*
     * Keep the existing SME catalogue
     * synchronization.
     */
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
     *
     * GET NEVER WRITES SETTINGS.
     */
    return NextResponse.json({
      success: true,

      controls,

      /*
       * Useful for the admin UI.
       *
       * This tells the frontend which providers
       * can currently be selected.
       */
      availableDataProviders:
        DATA_PROVIDERS,
    });
  } catch (error: any) {
    console.error(
      "GET /api/admin/provider-controls:",
      error
    );

    const message =
      error?.message ===
      "UNAUTHORIZED"
        ? "Unauthorized"
        : error?.message ===
          "FORBIDDEN"
        ? "Forbidden"
        : "Failed to load provider controls";

    const status =
      error?.message ===
      "UNAUTHORIZED"
        ? 401
        : error?.message ===
          "FORBIDDEN"
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
      typeof body !== "object" ||
      Array.isArray(body)
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

    /*
     * Existing boolean control groups.
     */
    const allowedBooleanGroups = [
      "sme_networks",
      "sme_service_types",
      "sme_data_plans",
      "data_provider_enabled",
    ];

    /*
     * NEW:
     *
     * Network ? provider mapping.
     */
    const dataProviders =
      body.data_providers;

    const updates: Record<
      string,
      any
    > = {};

    /*
     * -------------------------------------------------------
     * COLLECT EXISTING BOOLEAN GROUPS
     * -------------------------------------------------------
     */

    for (const group of
      allowedBooleanGroups) {
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

    /*
     * -------------------------------------------------------
     * COLLECT NETWORK ? PROVIDER
     * -------------------------------------------------------
     */

    if (
      dataProviders &&
      typeof dataProviders ===
        "object" &&
      !Array.isArray(
        dataProviders
      )
    ) {
      updates.data_providers =
        dataProviders;
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
     * -------------------------------------------------------
     */

    const setOperations: Record<
      string,
      any
    > = {};

    for (const [
      group,
      values,
    ] of Object.entries(
      updates
    )) {
      /*
       * ---------------------------------------------------
       * NETWORK ? PROVIDER
       * ---------------------------------------------------
       */

      if (
        group ===
        "data_providers"
      ) {
        for (const [
          network,
          providerValue,
        ] of Object.entries(
          values as Record<
            string,
            unknown
          >
        )) {
          const provider =
            normalizeProvider(
              providerValue
            );

          /*
           * Reject unsupported providers.
           */
          if (
            !isRegisteredDataProvider(
              provider
            )
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  `Unsupported data provider "${provider}".`,
                availableDataProviders:
                  DATA_PROVIDERS,
              },
              {
                status: 400,
              }
            );
          }

          /*
           * Network ID must be a non-empty key.
           */
          if (
            !["1", "2", "3", "4"].includes(String(network).trim())
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Invalid network ID supplied.",
              },
              { status: 400 }
            );
          }

          setOperations[
            `rates.data_providers.${network}`
          ] = provider;
        }

        continue;
      }

      /*
       * ---------------------------------------------------
       * BOOLEAN GROUPS
       * ---------------------------------------------------
       */

      for (const [
        code,
        value,
      ] of Object.entries(
        values as Record<
          string,
          any
        >
      )) {
        if (
          typeof value ===
          "boolean"
        ) {
          setOperations[
            `rates.${group}.${code}`
          ] = value;

          continue;
        }

        /*
         * Nested SME service types:
         *
         * sme_service_types:
         * {
         *   "1": {
         *     "SME": true
         *   }
         * }
         */
        if (
          group ===
            "sme_service_types" &&
          value &&
          typeof value ===
            "object" &&
          !Array.isArray(
            value
          )
        ) {
          for (const [
            serviceType,
            enabled,
          ] of Object.entries(
            value as Record<
              string,
              any
            >
          )) {
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
            "No valid provider-control values supplied",
        },
        { status: 400 }
      );
    }

    /*
     * -------------------------------------------------------
     * WRITE ONLY THE REQUESTED SETTINGS
     * -------------------------------------------------------
     */

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

    /*
     * -------------------------------------------------------
     * READ BACK
     * -------------------------------------------------------
     */

    const saved: any =
      await Settings.findOne({
        key:
          "provider_controls",
      })
        .select("rates")
        .lean()
        .exec();

    const savedRates =
      asObject(
        saved?.rates
      );

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

      availableDataProviders:
        DATA_PROVIDERS,
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/admin/provider-controls:",
      error
    );

    const message =
      error?.message ===
      "UNAUTHORIZED"
        ? "Unauthorized"
        : error?.message ===
          "FORBIDDEN"
        ? "Forbidden"
        : "Failed to update provider controls";

    const status =
      error?.message ===
      "UNAUTHORIZED"
        ? 401
        : error?.message ===
          "FORBIDDEN"
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