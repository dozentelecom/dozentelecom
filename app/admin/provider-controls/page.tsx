"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Controls = {
  sme_networks: Record<string, boolean>;

  sme_service_types: Record<
    string,
    Record<string, boolean>
  >;

  sme_data_plans: Record<string, boolean>;

  wisesub_electricity: Record<string, boolean>;

  wisesub_cable: Record<string, boolean>;

  wisesub_education: Record<string, boolean>;
};

type SmePlan = {
  id?: string | number;
  plan_id?: string | number;
  data_plan?: string | number;

  network_id?: string | number;
  networkId?: string | number;

  network?: string;
  network_name?: string;

  name?: string;
  plan_name?: string;
  plan?: string;

  type?: string;
  service_type?: string;
  serviceType?: string;

  price?: number;
  amount?: number;
  selling_price?: number;
  cost?: number;

  days?: string | number;
  validity?: string | number;
  duration?: string | number;
};

type ServiceNetwork = {
  networkId: string;
  network: string;
  serviceTypes: string[];
};

type ServiceTypesByNetwork = Record<
  string,
  ServiceNetwork
>;

const WISESUB_GROUPS = [
  {
    key: "wisesub_electricity",
    title: "Electricity Providers",
    description:
      "Control electricity distribution providers.",
    providers: [
      {
        code: "abuja",
        name: "Abuja Electric",
        icon: "⚡",
      },
      {
        code: "ikeja",
        name: "Ikeja Electric",
        icon: "⚡",
      },
      {
        code: "eko",
        name: "Eko Electric",
        icon: "⚡",
      },
      {
        code: "kano",
        name: "Kano Electric",
        icon: "⚡",
      },
      {
        code: "portharcourt",
        name: "Port Harcourt Electric",
        icon: "⚡",
      },
      {
        code: "jos",
        name: "Jos Electric",
        icon: "⚡",
      },
      {
        code: "ibadan",
        name: "Ibadan Electric",
        icon: "⚡",
      },
      {
        code: "kaduna",
        name: "Kaduna Electric",
        icon: "⚡",
      },
      {
        code: "benin",
        name: "Benin Electric",
        icon: "⚡",
      },
      {
        code: "aba",
        name: "Aba Electric",
        icon: "⚡",
      },
      {
        code: "enugu",
        name: "Enugu Electric",
        icon: "⚡",
      },
      {
        code: "yola",
        name: "Yola Electric",
        icon: "⚡",
      },
    ],
  },

  {
    key: "wisesub_cable",
    title: "Cable TV Providers",
    description:
      "Control cable TV providers.",
    providers: [
      {
        code: "dstv",
        name: "DSTV",
        icon: "📺",
      },
      {
        code: "gotv",
        name: "GOTV",
        icon: "📺",
      },
      {
        code: "startimes",
        name: "Startimes",
        icon: "📺",
      },
    ],
  },

  {
    key: "wisesub_education",
    title: "Education Providers",
    description:
      "Control education and examination PIN products.",
    providers: [
      {
        code: "result-checker",
        name: "WAEC Result Checker PIN",
        icon: "🎓",
      },
      {
        code: "registration",
        name: "WAEC Registration PIN",
        icon: "🎓",
      },
    ],
  },
] as const;

export default function ProviderControlsPage() {
  const [controls, setControls] =
    useState<Controls | null>(null);

  const [
    serviceTypesByNetwork,
    setServiceTypesByNetwork,
  ] =
    useState<ServiceTypesByNetwork>({});

  const [plans, setPlans] =
    useState<SmePlan[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  /* =========================================================
     NORMALIZE SME SERVICE TYPES
     ========================================================= */

  function normalizeServiceTypes(
    input: any
  ): ServiceTypesByNetwork {
    const result: ServiceTypesByNetwork =
      {};

    if (!input) {
      return result;
    }

    /* ---------------------------------------------------------
       OBJECT FORMAT

       {
         "1": {
           networkId: "1",
           network: "MTN",
           serviceTypes: [...]
         }
       }
       --------------------------------------------------------- */

    if (
      typeof input === "object" &&
      !Array.isArray(input)
    ) {
      for (const [
        objectKey,
        value,
      ] of Object.entries(input)) {
        if (
          !value ||
          typeof value !== "object"
        ) {
          continue;
        }

        const item = value as any;

        const networkId =
          String(
            item?.networkId ??
              item?.network_id ??
              objectKey ??
              ""
          ).trim();

        if (!networkId) {
          continue;
        }

        const networkName =
          String(
            item?.network ??
              item?.network_name ??
              networkId
          ).trim();

        const rawTypes =
          Array.isArray(
            item?.serviceTypes
          )
            ? item.serviceTypes
            : Array.isArray(
                item?.service_types
              )
            ? item.service_types
            : [];

        const serviceTypes =
          rawTypes
            .map((type: any) =>
              String(type ?? "").trim()
            )
            .filter(
              (type: string) =>
                type.length > 0
            );

        if (!result[networkId]) {
          result[networkId] = {
            networkId,
            network:
              networkName ||
              `Network ${networkId}`,
            serviceTypes: [],
          };
        }

        result[networkId].serviceTypes =
          Array.from(
            new Set([
              ...result[networkId]
                .serviceTypes,
              ...serviceTypes,
            ])
          );
      }

      return result;
    }

    /* ---------------------------------------------------------
       ARRAY FORMAT
       --------------------------------------------------------- */

    if (Array.isArray(input)) {
      for (const item of input) {
        if (
          !item ||
          typeof item !== "object"
        ) {
          continue;
        }

        const networkId =
          String(
            item?.networkId ??
              item?.network_id ??
              ""
          ).trim();

        if (!networkId) {
          continue;
        }

        const networkName =
          String(
            item?.network ??
              item?.network_name ??
              networkId
          ).trim();

        const rawTypes =
          Array.isArray(
            item?.serviceTypes
          )
            ? item.serviceTypes
            : Array.isArray(
                item?.service_types
              )
            ? item.service_types
            : [];

        const serviceTypes =
          rawTypes
            .map((type: any) =>
              String(type ?? "").trim()
            )
            .filter(
              (type: string) =>
                type.length > 0
            );

        if (!result[networkId]) {
          result[networkId] = {
            networkId,
            network:
              networkName ||
              `Network ${networkId}`,
            serviceTypes: [],
          };
        }

        result[networkId].serviceTypes =
          Array.from(
            new Set([
              ...result[networkId]
                .serviceTypes,
              ...serviceTypes,
            ])
          );
      }
    }

    return result;
  }

  /* =========================================================
     BUILD SERVICE TYPES DIRECTLY FROM SME PLANS
     ========================================================= */

  function buildServiceTypesFromPlans(
    rawPlans: any[]
  ): ServiceTypesByNetwork {
    const result: ServiceTypesByNetwork =
      {};

    if (!Array.isArray(rawPlans)) {
      return result;
    }

    for (const plan of rawPlans) {
      if (
        !plan ||
        typeof plan !== "object"
      ) {
        continue;
      }

      const networkId =
        String(
          plan?.network_id ??
            plan?.networkId ??
            ""
        ).trim();

      const networkName =
        String(
          plan?.network ??
            plan?.network_name ??
            networkId
        ).trim();

      const serviceType =
        String(
          plan?.type ??
            plan?.service_type ??
            plan?.serviceType ??
            ""
        ).trim();

      if (
        !networkId ||
        !serviceType
      ) {
        continue;
      }

      if (!result[networkId]) {
        result[networkId] = {
          networkId,
          network:
            networkName ||
            `Network ${networkId}`,
          serviceTypes: [],
        };
      }

      if (
        !result[
          networkId
        ].serviceTypes.includes(
          serviceType
        )
      ) {
        result[
          networkId
        ].serviceTypes.push(
          serviceType
        );
      }
    }

    return result;
  }

  /* =========================================================
     MERGE SERVICE TYPE CATALOGUES
     ========================================================= */

  function mergeServiceTypes(
    first: ServiceTypesByNetwork,
    second: ServiceTypesByNetwork
  ): ServiceTypesByNetwork {
    const result: ServiceTypesByNetwork =
      {};

    const networkIds =
      Array.from(
        new Set([
          ...Object.keys(first || {}),
          ...Object.keys(second || {}),
        ])
      );

    for (const networkId of networkIds) {
      if (!networkId) {
        continue;
      }

      const firstNetwork =
        first?.[networkId];

      const secondNetwork =
        second?.[networkId];

      const networkName =
        secondNetwork?.network ||
        firstNetwork?.network ||
        `Network ${networkId}`;

      const serviceTypes =
        Array.from(
          new Set([
            ...(firstNetwork?.serviceTypes ||
              []),
            ...(secondNetwork?.serviceTypes ||
              []),
          ])
        )
          .map((type) =>
            String(type ?? "").trim()
          )
          .filter(
            (type) =>
              type.length > 0
          );

      result[networkId] = {
        networkId,
        network: networkName,
        serviceTypes,
      };
    }

    return result;
  }

  /* =========================================================
     LOAD
     ========================================================= */

  async function loadControls() {
    try {
      setLoading(true);
      setMessage("");

      /* -------------------------------------------------------
         LOAD ADMIN PROVIDER CONTROLS
         ------------------------------------------------------- */

      const response =
        await fetch(
          "/api/admin/provider-controls",
          {
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load provider controls"
        );
      }

      setControls(
        data?.controls || null
      );

      /* -------------------------------------------------------
         LOAD CATALOGUE FROM ADMIN API
         ------------------------------------------------------- */

      const catalogue =
        data?.catalogue || {};

      const catalogueServiceTypes =
        normalizeServiceTypes(
          catalogue?.serviceTypesByNetwork ??
            catalogue?.serviceTypes ??
            data?.serviceTypesByNetwork ??
            {}
        );

      /* -------------------------------------------------------
         LOAD ACTUAL SME DATA PLANS
         ------------------------------------------------------- */

      const plansResponse =
        await fetch(
          "/api/sme/data-plans",
          {
            cache: "no-store",
          }
        );

      const plansData =
        await plansResponse.json();

      let validPlans: SmePlan[] = [];

      if (plansResponse.ok) {
        const rawPlans =
          Array.isArray(
            plansData?.plans
          )
            ? plansData.plans
            : [];

        validPlans =
          rawPlans.filter(
            (plan: any) =>
              plan &&
              typeof plan ===
                "object"
          );

        setPlans(
          validPlans
        );
      } else {
        setPlans([]);
      }

      /* -------------------------------------------------------
         BUILD SERVICE TYPES FROM LIVE SME PLANS

         This is the important fix.

         SME response contains:

         network_id
         network
         type

         Example:

         MTN / 1 / SME
         MTN / 1 / SME2
         MTN / 1 / Coupon
         etc.
         ------------------------------------------------------- */

      const liveServiceTypes =
        buildServiceTypesFromPlans(
          validPlans
        );

      /* -------------------------------------------------------
         ALSO USE serviceTypesByNetwork RETURNED BY API
         ------------------------------------------------------- */

      const planEndpointServiceTypes =
        normalizeServiceTypes(
          plansData?.serviceTypesByNetwork ??
            {}
        );

      /* -------------------------------------------------------
         MERGE ALL AVAILABLE SOURCES

         Priority is effectively:

         live SME plans
         + /api/sme/data-plans catalogue
         + admin provider-controls catalogue
         ------------------------------------------------------- */

      const mergedServiceTypes =
        mergeServiceTypes(
          mergeServiceTypes(
            catalogueServiceTypes,
            planEndpointServiceTypes
          ),
          liveServiceTypes
        );

      setServiceTypesByNetwork(
        mergedServiceTypes
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to load provider controls"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadControls();
  }, []);

  /* =========================================================
     TOGGLE NORMAL PROVIDER
     ========================================================= */

  async function toggleProvider(
    group: string,
    code: string
  ) {
    if (
      !controls ||
      saving
    ) {
      return;
    }

    const currentValue =
      controls[
        group as keyof Controls
      ]?.[code] !== false;

    const newValue =
      !currentValue;

    setSaving(
      `${group}:${code}`
    );

    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/provider-controls",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              [group]: {
                [code]:
                  newValue,
              },
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update provider"
        );
      }

      setControls(
        data?.controls ||
          controls
      );

      setMessage(
        `${code} provider ${
          newValue
            ? "enabled"
            : "disabled"
        } successfully.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to update provider"
      );
    } finally {
      setSaving(null);
    }
  }

  /* =========================================================
     TOGGLE SME NETWORK
     ========================================================= */

  async function toggleSmeNetwork(
    networkId: string
  ) {
    if (
      !controls ||
      saving ||
      !networkId
    ) {
      return;
    }

    const current =
      controls.sme_networks?.[
        networkId
      ] !== false;

    const next =
      !current;

    setSaving(
      `sme_network:${networkId}`
    );

    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/provider-controls",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              sme_networks: {
                [networkId]:
                  next,
              },
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update network"
        );
      }

      setControls(
        data?.controls ||
          controls
      );

      setMessage(
        `Network ${networkId} ${
          next
            ? "enabled"
            : "disabled"
        } successfully.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to update network"
      );
    } finally {
      setSaving(null);
    }
  }

  /* =========================================================
     TOGGLE SERVICE TYPE
     ========================================================= */

  async function toggleServiceType(
    networkId: string,
    serviceType: string
  ) {
    if (
      !controls ||
      saving ||
      !networkId ||
      !serviceType
    ) {
      return;
    }

    const current =
      controls
        .sme_service_types?.[
          networkId
        ]?.[
          serviceType
        ] !== false;

    const next =
      !current;

    const key =
      `service_type:${networkId}:${serviceType}`;

    setSaving(key);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/provider-controls",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              sme_service_types: {
                [networkId]: {
                  [serviceType]:
                    next,
                },
              },
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update service type"
        );
      }

      setControls(
        data?.controls ||
          controls
      );

      setMessage(
        `${serviceType} ${
          next
            ? "enabled"
            : "disabled"
        } successfully.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to update service type"
      );
    } finally {
      setSaving(null);
    }
  }

  /* =========================================================
     TOGGLE DATA PLAN
     ========================================================= */

  async function toggleDataPlan(
    planId: string
  ) {
    if (
      !controls ||
      saving ||
      !planId
    ) {
      return;
    }

    const current =
      controls.sme_data_plans?.[
        planId
      ] !== false;

    const next =
      !current;

    const key =
      `data_plan:${planId}`;

    setSaving(key);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/admin/provider-controls",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              sme_data_plans: {
                [planId]:
                  next,
              },
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update data plan"
        );
      }

      setControls(
        data?.controls ||
          controls
      );

      setMessage(
        `Data plan ${planId} ${
          next
            ? "enabled"
            : "disabled"
        } successfully.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to update data plan"
      );
    } finally {
      setSaving(null);
    }
  }

  /* =========================================================
     NETWORK NAME
     ========================================================= */

  function getNetworkName(
    networkId: string
  ) {
    if (!networkId) {
      return "Unknown Network";
    }

    const network =
      serviceTypesByNetwork[
        networkId
      ];

    return (
      network?.network ||
      `Network ${networkId}`
    );
  }

  /* =========================================================
     SME NETWORK IDS
     ========================================================= */

  const smeNetworkIds =
    Object.keys(
      serviceTypesByNetwork
    ).length > 0
      ? Object.keys(
          serviceTypesByNetwork
        )
      : Object.keys(
          controls?.sme_networks ||
            {}
        );

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className="admin-provider-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="admin-provider-header">

        <div>

          <Link
            href="/admin"
            className="admin-provider-back"
          >
            ← Back to Admin
          </Link>

          <h1>
            Provider Controls
          </h1>

          <p>
            Networks, service types and
            data plans are loaded directly
            from the provider API.
          </p>

        </div>

      </div>

      {/* =====================================================
          MESSAGE
          ===================================================== */}

      {message && (
        <div className="admin-provider-message">
          {message}
        </div>
      )}

      {/* =====================================================
          LOADING
          ===================================================== */}

      {loading ? (
        <div className="admin-provider-loading">
          Loading live provider catalogue...
        </div>
      ) : (
        <div className="admin-provider-groups">

          {/* =================================================
              SME NETWORKS
              ================================================= */}

          <section className="admin-provider-section">

            <div className="admin-provider-section-header">

              <div>

                <h2>
                  SME Data Networks
                </h2>

                <p>
                  Networks currently returned
                  by SMEAPI.
                </p>

              </div>

            </div>

            <div className="admin-provider-grid">

              {smeNetworkIds
                .filter(
                  (networkId) =>
                    String(
                      networkId
                    ).trim() !== ""
                )
                .map(
                  (networkId) => {

                    const safeNetworkId =
                      String(
                        networkId
                      ).trim();

                    const enabled =
                      controls
                        ?.sme_networks?.[
                          safeNetworkId
                        ] !== false;

                    const savingNetwork =
                      saving ===
                      `sme_network:${safeNetworkId}`;

                    return (
                      <div
                        key={`network-${safeNetworkId}`}
                        className={`admin-provider-card ${
                          enabled
                            ? "enabled"
                            : "disabled"
                        }`}
                      >

                        <div className="admin-provider-icon">
                          📱
                        </div>

                        <div className="admin-provider-info">

                          <h3>
                            {getNetworkName(
                              safeNetworkId
                            )}
                          </h3>

                          <span>
                            Network ID:{" "}
                            {safeNetworkId}
                          </span>

                          <span
                            className={`admin-provider-status ${
                              enabled
                                ? "enabled"
                                : "disabled"
                            }`}
                          >
                            ●{" "}
                            {enabled
                              ? "Enabled"
                              : "Disabled"}
                          </span>

                        </div>

                        <button
                          type="button"
                          disabled={
                            !!saving
                          }
                          onClick={() =>
                            toggleSmeNetwork(
                              safeNetworkId
                            )
                          }
                          className={`admin-provider-toggle ${
                            enabled
                              ? "on"
                              : "off"
                          }`}
                        >
                          {savingNetwork
                            ? "Saving..."
                            : enabled
                            ? "Disable"
                            : "Enable"}
                        </button>

                      </div>
                    );
                  }
                )}

            </div>

          </section>

          {/* =================================================
              SME SERVICE TYPES
              ================================================= */}

          <section className="admin-provider-section">

            <div className="admin-provider-section-header">

              <div>

                <h2>
                  SME Service Types
                </h2>

                <p>
                  Automatically discovered
                  from SMEAPI.
                </p>

              </div>

            </div>

            {Object.values(
              serviceTypesByNetwork
            )
              .filter(
                (
                  network
                ) =>
                  network &&
                  typeof network ===
                    "object" &&
                  typeof network.networkId ===
                    "string" &&
                  network.networkId.trim() !== ""
              )
              .map(
                (network) => {

                  const networkId =
                    String(
                      network.networkId
                    ).trim();

                  if (!networkId) {
                    return null;
                  }

                  const networkEnabled =
                    controls
                      ?.sme_networks?.[
                        networkId
                      ] !== false;

                  const serviceTypes =
                    Array.isArray(
                      network.serviceTypes
                    )
                      ? Array.from(
                          new Set(
                            network.serviceTypes
                              .map(
                                (
                                  type
                                ) =>
                                  String(
                                    type ??
                                      ""
                                  ).trim()
                              )
                              .filter(
                                (
                                  type
                                ) =>
                                  type.length >
                                  0
                              )
                          )
                        )
                      : [];

                  return (
                    <div
                      key={`service-network-${networkId}`}
                      className="admin-provider-section"
                    >

                      <div className="admin-provider-section-header">

                        <div>

                          <h2>
                            {network.network ||
                              `Network ${networkId}`}
                          </h2>

                          <p>
                            Network ID:{" "}
                            {networkId}
                          </p>

                        </div>

                      </div>

                      {serviceTypes.length ===
                      0 ? (
                        <div className="admin-provider-loading">
                          No service types
                          returned for this
                          network.
                        </div>
                      ) : (
                        <div className="admin-provider-grid">

                          {serviceTypes.map(
                            (
                              serviceType
                            ) => {

                              const safeType =
                                String(
                                  serviceType
                                ).trim();

                              if (
                                !safeType
                              ) {
                                return null;
                              }

                              const enabled =
                                controls
                                  ?.sme_service_types?.[
                                    networkId
                                  ]?.[
                                    safeType
                                  ] !== false;

                              const isSaving =
                                saving ===
                                `service_type:${networkId}:${safeType}`;

                              return (
                                <div
                                  key={`service-type-${networkId}-${safeType}`}
                                  className={`admin-provider-card ${
                                    enabled &&
                                    networkEnabled
                                      ? "enabled"
                                      : "disabled"
                                  }`}
                                >

                                  <div className="admin-provider-icon">
                                    📦
                                  </div>

                                  <div className="admin-provider-info">

                                    <h3>
                                      {safeType}
                                    </h3>

                                    <span
                                      className={`admin-provider-status ${
                                        enabled &&
                                        networkEnabled
                                          ? "enabled"
                                          : "disabled"
                                      }`}
                                    >
                                      ●{" "}
                                      {!networkEnabled
                                        ? "Network Disabled"
                                        : enabled
                                        ? "Enabled"
                                        : "Disabled"}
                                    </span>

                                  </div>

                                  <button
                                    type="button"
                                    disabled={
                                      !!saving ||
                                      !networkEnabled
                                    }
                                    onClick={() =>
                                      toggleServiceType(
                                        networkId,
                                        safeType
                                      )
                                    }
                                    className={`admin-provider-toggle ${
                                      enabled
                                        ? "on"
                                        : "off"
                                    }`}
                                  >
                                    {isSaving
                                      ? "Saving..."
                                      : !networkEnabled
                                      ? "Network Off"
                                      : enabled
                                      ? "Disable"
                                      : "Enable"}
                                  </button>

                                </div>
                              );
                            }
                          )}

                        </div>
                      )}

                    </div>
                  );
                }
              )}

          </section>

          {/* =================================================
              SME DATA PLANS
              ================================================= */}

          <section className="admin-provider-section">

            <div className="admin-provider-section-header">

              <div>

                <h2>
                  SME Data Plans
                </h2>

                <p>
                  Data plans are automatically
                  loaded from SMEAPI. Newly
                  discovered plans are enabled
                  by default.
                </p>

              </div>

            </div>

            {plans.length === 0 ? (
              <div className="admin-provider-loading">
                No data plans returned by
                SMEAPI.
              </div>
            ) : (
              <div className="admin-provider-grid">

                {plans.map(
                  (
                    plan,
                    index
                  ) => {

                    const rawPlanId =
                      plan?.id ??
                      plan?.plan_id ??
                      plan?.data_plan ??
                      "";

                    const planId =
                      String(
                        rawPlanId
                      ).trim();

                    if (!planId) {
                      return null;
                    }

                    const networkId =
                      String(
                        plan?.network_id ??
                          plan?.networkId ??
                          ""
                      ).trim();

                    const serviceType =
                      String(
                        plan?.type ??
                          plan?.service_type ??
                          plan?.serviceType ??
                          "SME"
                      ).trim() ||
                      "SME";

                    const planName =
                      String(
                        plan?.name ??
                          plan?.plan_name ??
                          plan?.plan ??
                          "Data Plan"
                      ).trim() ||
                      "Data Plan";

                    const price =
                      Number(
                        plan?.price ??
                          plan?.amount ??
                          plan?.selling_price ??
                          plan?.cost ??
                          0
                      );

                    const safePrice =
                      Number.isFinite(
                        price
                      )
                        ? price
                        : 0;

                    const enabled =
                      controls
                        ?.sme_data_plans?.[
                          planId
                        ] !== false;

                    const isSaving =
                      saving ===
                      `data_plan:${planId}`;

                    const networkEnabled =
                      networkId
                        ? controls
                            ?.sme_networks?.[
                              networkId
                            ] !== false
                        : false;

                    const planKey =
                      `data-plan-${networkId}-${serviceType}-${planId}-${index}`;

                    return (
                      <div
                        key={planKey}
                        className={`admin-provider-card ${
                          enabled &&
                          networkEnabled
                            ? "enabled"
                            : "disabled"
                        }`}
                      >

                        <div className="admin-provider-icon">
                          📶
                        </div>

                        <div className="admin-provider-info">

                          <h3>
                            {planName}
                          </h3>

                          <span>
                            Plan ID:{" "}
                            {planId}
                          </span>

                          <span>
                            Network:{" "}
                            {networkId
                              ? getNetworkName(
                                  networkId
                                )
                              : "Unknown Network"}
                          </span>

                          <span>
                            Type:{" "}
                            {serviceType}
                          </span>

                          <span>
                            ₦
                            {safePrice.toLocaleString()}
                          </span>

                          <span
                            className={`admin-provider-status ${
                              enabled &&
                              networkEnabled
                                ? "enabled"
                                : "disabled"
                            }`}
                          >
                            ●{" "}
                            {!networkId
                              ? "Network Missing"
                              : !networkEnabled
                              ? "Network Disabled"
                              : enabled
                              ? "Enabled"
                              : "Disabled"}
                          </span>

                        </div>

                        <button
                          type="button"
                          disabled={
                            !!saving ||
                            !networkEnabled ||
                            !planId
                          }
                          onClick={() =>
                            toggleDataPlan(
                              planId
                            )
                          }
                          className={`admin-provider-toggle ${
                            enabled
                              ? "on"
                              : "off"
                          }`}
                        >
                          {isSaving
                            ? "Saving..."
                            : !networkEnabled
                            ? "Network Off"
                            : enabled
                            ? "Disable"
                            : "Enable"}
                        </button>

                      </div>
                    );
                  }
                )}

              </div>
            )}

          </section>

          {/* =================================================
              WISESUB
              ================================================= */}

          {WISESUB_GROUPS.map(
            (group) => (
              <section
                key={`wisesub-group-${group.key}`}
                className="admin-provider-section"
              >

                <div className="admin-provider-section-header">

                  <div>

                    <h2>
                      {group.title}
                    </h2>

                    <p>
                      {group.description}
                    </p>

                  </div>

                </div>

                <div className="admin-provider-grid">

                  {group.providers.map(
                    (provider) => {

                      const enabled =
                        controls?.[
                          group.key
                        ]?.[
                          provider.code
                        ] !== false;

                      const isSaving =
                        saving ===
                        `${group.key}:${provider.code}`;

                      return (
                        <div
                          key={`${group.key}-${provider.code}`}
                          className={`admin-provider-card ${
                            enabled
                              ? "enabled"
                              : "disabled"
                          }`}
                        >

                          <div className="admin-provider-icon">
                            {provider.icon}
                          </div>

                          <div className="admin-provider-info">

                            <h3>
                              {provider.name}
                            </h3>

                            <span
                              className={`admin-provider-status ${
                                enabled
                                  ? "enabled"
                                  : "disabled"
                              }`}
                            >
                              ●{" "}
                              {enabled
                                ? "Enabled"
                                : "Disabled"}
                            </span>

                          </div>

                          <button
                            type="button"
                            disabled={
                              !!saving
                            }
                            onClick={() =>
                              toggleProvider(
                                group.key,
                                provider.code
                              )
                            }
                            className={`admin-provider-toggle ${
                              enabled
                                ? "on"
                                : "off"
                            }`}
                          >
                            {isSaving
                              ? "Saving..."
                              : enabled
                              ? "Disable"
                              : "Enable"}
                          </button>

                        </div>
                      );
                    }
                  )}

                </div>

              </section>
            )
          )}

        </div>
      )}
    </div>
  );
}