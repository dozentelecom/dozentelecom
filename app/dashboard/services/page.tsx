"use client";

import { useEffect, useMemo, useState } from "react";

type Tab =
  | "airtime"
  | "data"
  | "electricity"
  | "cable"
  | "education";

const tabs: [Tab, string, string][] = [
  ["airtime", "Airtime", "📱"],
  ["data", "Data", "📶"],
  ["electricity", "Electricity", "⚡"],
  ["cable", "Cable TV", "📺"],
  ["education", "Education", "🎓"],
];

/* =========================================================
   GENERIC API HELPERS
========================================================= */

async function api(
  url: string,
  options: RequestInit = {}
) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const json = await response
    .json()
    .catch(() => ({
      error: "Invalid server response",
    }));

  if (!response.ok) {
    throw new Error(
      json?.error ||
        json?.message ||
        "Request failed"
    );
  }

  return json;
}

const post = (
  url: string,
  body: any
) =>
  api(url, {
    method: "POST",
    body: JSON.stringify(body),
  });

/* =========================================================
   INPUT FIELD
========================================================= */

function Field({
  label,
  ...props
}: any) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        className="input"
        {...props}
      />
    </label>
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function ServicesClient() {
  const [tab, setTab] =
    useState<Tab>("airtime");

  /* =======================================================
     SME DATA
  ======================================================= */

  const [plans, setPlans] =
    useState<any[]>([]);

/* =======================================================
   ADMIN PRICING
======================================================= */

const [rates, setRates] = useState({
  data: 0,
  electricity: 0,
  cable: 0,
  education: 0,
  airtimeToCash: 0,
  funding: 0,
  airtimeRoundUnit: 100,
});
  /* =======================================================
     WISESUB SERVICES
  ======================================================= */

  const [
    electricityProviders,
    setElectricityProviders,
  ] = useState<any[]>([]);

  const [
    cableProviders,
    setCableProviders,
  ] = useState<any[]>([]);

  const [
    educationProviders,
    setEducationProviders,
  ] = useState<any[]>([]);

  /* =======================================================
     WISESUB PACKAGES
  ======================================================= */

  const [
    cablePlans,
    setCablePlans,
  ] = useState<any[]>([]);

  const [
    educationPlans,
    setEducationPlans,
  ] = useState<any[]>([]);

  /* =======================================================
     STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [serviceType, setServiceType] =
    useState("");

  /* =======================================================
     FORM
  ======================================================= */

  const [form, setForm] =
    useState<any>({
      network: "",
      data_plan: "",

      phone: "",
      amount: "",

      pin: "",

      provider: "",

      plan: "",

      iucnumber: "",

      meternumber: "",

      metertype: "prepaid",

      subtype: "renew",

      quantity: "1",

      businessname:"",

      examProvider: "",

      examPackage:""
    });

  const update = (
    key: string,
    value: any
  ) => {
    setForm((current: any) => ({
      ...current,
      [key]: value,
    }));
  };

/* =======================================================
   CUSTOMER SELLING PRICE
======================================================= */

function customerPrice(
  cost: number,
  service: keyof typeof rates
) {
  const amount = Number(cost) || 0;
  const rate = Number(rates[service]) || 0;

  return Math.ceil(
    amount * (1 + rate / 100) * 100
  ) / 100;
}

  /* =======================================================
     DATA PLAN NORMALIZATION
  ======================================================= */

  const dataPlans = useMemo(() => {
    return plans.map(
      (p: any, index: number) => ({
        raw: p,

        key: String(
          p?.id ??
            p?.plan_id ??
            p?.data_plan ??
            index
        ),

        name: String(
          p?.name ??
            p?.plan_name ??
            p?.plan ??
            p?.variation ??
            p?.description ??
            "Data plan"
        ),

        cost: Number(
  p?.price ??
    p?.amount ??
    p?.selling_price ??
    p?.cost ??
    0
),

price: customerPrice(
  Number(
    p?.price ??
      p?.amount ??
      p?.selling_price ??
      p?.cost ??
      0
  ),
  "data"
),

        network: String(
          p?.network ??
            p?.network_name ??
            p?.network_id ??
            ""
        ),

        networkId: String(
          p?.network_id ??
            p?.network ??
            ""
        ),

        type: String(
          p?.type ??
            p?.datagroup ??
            p?.service_type ??
            "SME"
        ),

        days: String(
          p?.days ??
            p?.validity ??
            p?.duration ??
            "30 days"
        ),
      })
    );
 }, [plans, rates]);

  /* =======================================================
     DATA SERVICE TYPES
  ======================================================= */

  const serviceTypes = useMemo(() => {
    if (!form.network) {
      return [];
    }

    const types =
      new Set<string>();

    for (const plan of dataPlans) {
      if (
        String(plan.networkId) ===
          String(form.network) &&
        plan.type
      ) {
        types.add(plan.type);
      }
    }

    return Array.from(types);
  }, [
    dataPlans,
    form.network,
  ]);

  /* =======================================================
     DATA NETWORKS
  ======================================================= */

  const networkOptions =
    useMemo(() => {
      const map =
        new Map<string, any>();

      for (const plan of plans) {
        const networkId =
          String(
            plan?.network_id ??
              plan?.network ??
              ""
          );

        const networkName =
          String(
            plan?.network_name ??
              plan?.network ??
              ""
          );

        if (
          networkId &&
          networkName &&
          !map.has(networkId)
        ) {
          map.set(
            networkId,
            {
              id: networkId,
              name: networkName,
            }
          );
        }
      }

      return Array.from(
        map.values()
      );
    }, [plans]);

  /* =======================================================
     LOAD INITIAL SERVICES
  ======================================================= */

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    setError("");

    try {
const pricingResponse =
  await api("/api/pricing");

const loadedRates =
  pricingResponse?.rates;

if (loadedRates) {
  setRates({
    data: Number(
      loadedRates.data ?? 0
    ),
    electricity: Number(
      loadedRates.electricity ?? 0
    ),
    cable: Number(
      loadedRates.cable ?? 0
    ),
    education: Number(
      loadedRates.education ?? 0
    ),
    airtimeToCash: Number(
      loadedRates.airtimeToCash ?? 0
    ),
    funding: Number(
      loadedRates.funding ?? 0
    ),
    airtimeRoundUnit: Number(
      loadedRates.airtimeRoundUnit ?? 100
    ),
  });
}
      /* ================================================
         SME API
         DATA ONLY
      ================================================= */

      const plansResponse =
        await api(
          "/api/sme/data-plans"
        );

      const receivedPlans =
        plansResponse?.plans ??
        plansResponse?.data?.plans ??
        plansResponse?.data ??
        [];

      setPlans(
        Array.isArray(
          receivedPlans
        )
          ? receivedPlans
          : []
      );

      /* ================================================
         WISESUB SERVICES
      ================================================= */

      const wiseSubResponse =
        await api(
          "/api/wisesub/services"
        );

      console.log(
        "RAW WISESUB SERVICES:",
        wiseSubResponse
      );

      const electricity =
        wiseSubResponse
          ?.data
          ?.electricity ?? [];

      const cable =
        wiseSubResponse
          ?.data
          ?.cable_tv ?? [];

      const education =
        wiseSubResponse
          ?.data
          ?.education ?? [];

      setElectricityProviders(
        Array.isArray(electricity)
          ? electricity
          : []
      );

      setCableProviders(
        Array.isArray(cable)
          ? cable
          : []
      );

      setEducationProviders(
        Array.isArray(education)
          ? education
          : []
      );

      console.log(
        "WISESUB ELECTRICITY:",
        electricity
      );

      console.log(
        "WISESUB CABLE:",
        cable
      );

      console.log(
        "WISESUB EDUCATION:",
        education
      );
    } catch (e: any) {
      console.error(
        "SERVICE CATALOG LOAD ERROR:",
        e
      );

      setError(
        e?.message ||
          "Unable to load services"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     LOAD CABLE PLANS
  ======================================================= */

  async function loadCablePlans(providerCode: string) {
  if (!providerCode) {
    setCablePlans([]);
    return;
  }

  setLoading(true);
  setError("");

  try {
    const j = await api(
      `/api/wisesub/packages?service_type=cabletv&provider_code=${encodeURIComponent(providerCode)}`
    );

    const packages =
      j?.data?.packages ??
      [];

    setCablePlans(
      Array.isArray(packages)
        ? packages
        : []
    );
  } catch (e: any) {
    console.error("CABLE PACKAGES ERROR:", e);

    setCablePlans([]);

    setError(
      e?.message ||
      "Unable to load cable plans"
    );
  } finally {
    setLoading(false);
  }
}

  /* =======================================================
     LOAD EDUCATION PACKAGES
  ======================================================= */

  async function loadEducationPlans(providerCode: string) {
  if (!providerCode) {
    setEducationPlans([]);
    return;
  }

  setLoading(true);
  setError("");

  try {
    const j = await api(
      `/api/wisesub/packages?service_type=education&provider_code=${encodeURIComponent(
        providerCode
      )}`
    );

    const packages =
      j?.data?.packages ?? [];

    setEducationPlans(
      Array.isArray(packages)
        ? packages
        : []
    );

    console.log(
      "WISESUB EDUCATION PACKAGES:",
      packages
    );
  } catch (e: any) {
    console.error(
      "WISESUB EDUCATION PACKAGES ERROR:",
      e
    );

    setEducationPlans([]);

    setError(
      e?.message ||
        "Unable to load education packages"
    );
  } finally {
    setLoading(false);
  }
}

  /* =======================================================
     ELECTRICITY VERIFICATION
  ======================================================= */

  async function verifyElectricity() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!form.provider) {
        throw new Error(
          "Please select an electricity company."
        );
      }

      if (!form.meternumber) {
        throw new Error(
          "Please enter the meter number."
        );
      }

      const response =
        await post(
          "/api/wisesub/verify",
          {
            service_type:
              "electricity",

            provider_code:
              form.provider,

            meter_number:
              form.meternumber,

            meter_type:
              form.metertype,
          }
        );

      console.log(
        "WISESUB ELECTRICITY VERIFY:",
        response
      );

      const customer =
        response?.data;

      if (
        customer?.customer_name
      ) {
        setMessage(
          `Meter verified: ${customer.customer_name}${
            customer?.address
              ? ` — ${customer.address}`
              : ""
          }`
        );
      } else {
        setMessage(
          response?.message ||
            "Meter verified successfully."
        );
      }
    } catch (e: any) {
      console.error(
        "ELECTRICITY VERIFY ERROR:",
        e
      );

      setError(
        e?.message ||
          "Meter verification failed"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     CABLE VERIFICATION
  ======================================================= */

  async function verifyCable() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (!form.provider) {
        throw new Error(
          "Please select a cable provider."
        );
      }

      if (!form.iucnumber) {
        throw new Error(
          "Please enter the decoder number."
        );
      }

      const response =
        await post(
          "/api/wisesub/verify",
          {
            service_type:
              "cabletv",

            provider_code:
              form.provider,

            decoder_number:
              form.iucnumber,
          }
        );

      console.log(
        "WISESUB CABLE VERIFY:",
        response
      );

      const customer =
        response?.data;

      if (
        customer?.customer_name
      ) {
        setMessage(
          `Decoder verified: ${customer.customer_name}`
        );
      } else {
        setMessage(
          response?.message ||
            "IUC verified successfully."
        );
      }
    } catch (e: any) {
      console.error(
        "CABLE VERIFY ERROR:",
        e
      );

      setError(
        e?.message ||
          "IUC verification failed"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     PURCHASE
  ======================================================= */

  async function buy() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      let response: any;

      /* ================================================
         SME AIRTIME
      ================================================= */

      if (tab === "airtime") {
        if (!form.network) {
          throw new Error(
            "Please select a network."
          );
        }

        if (!form.phone) {
          throw new Error(
            "Please enter the phone number."
          );
        }

        if (!form.amount) {
          throw new Error(
            "Please enter the airtime amount."
          );
        }

        response =
          await post(
            "/api/sme/airtime",
            {
              network:
                Number(
                  form.network
                ),

              phone:
                form.phone,

              amount:
                Number(
                  form.amount
                ),

              airtime_type:
                "VTU",

              pin:
                form.pin,
            }
          );
      }

      /* ================================================
         SME DATA
      ================================================= */

      else if (
        tab === "data"
      ) {
        if (!form.network) {
          throw new Error(
            "Please select a network."
          );
        }

        if (!form.data_plan) {
          throw new Error(
            "Please select a data plan."
          );
        }

        if (!form.phone) {
          throw new Error(
            "Please enter the phone number."
          );
        }

        response =
          await post(
            "/api/sme/data",
            {
              network:
                Number(
                  form.network
                ),

              data_plan:
                Number(
                  form.data_plan
                ),

              phone:
                form.phone,

              pin:
                form.pin,
            }
          );
      }

      /* ================================================
         WISESUB ELECTRICITY
      ================================================= */

      else if (
        tab === "electricity"
      ) {
        if (!form.provider) {
          throw new Error(
            "Please select an electricity company."
          );
        }

        if (!form.meternumber) {
          throw new Error(
            "Please enter the meter number."
          );
        }

        if (!form.amount) {
          throw new Error(
            "Please enter the amount."
          );
        }

        response =
          await post(
            "/api/wisesub/purchase",
            {
              service_type:
                "electricity",

              provider_code:
                form.provider,

              meter_number:
                form.meternumber,

              meter_type:
                form.metertype,

              amount:
                Number(
                  form.amount
                ),

              phone:
                form.phone,
	      pin: 
		form.pin,
            }
          );
      }

      /* ================================================
         WISESUB CABLE TV
      ================================================= */

      else if (
        tab === "cable"
      ) {
        if (!form.provider) {
          throw new Error(
            "Please select a cable provider."
          );
        }

        if (!form.plan) {
          throw new Error(
            "Please select a cable plan."
          );
        }

        if (!form.iucnumber) {
          throw new Error(
            "Please enter the decoder number."
          );
        }

        response =
          await post(
            "/api/wisesub/purchase",
            {
              service_type:
                "cabletv",

              provider_code:
                form.provider,

              package_code:
                form.plan,

              decoder_number:
                form.iucnumber,

              phone:
                form.phone,

              subscription_type:
                form.subtype,
	      pin: 
		form.pin,
            }
          );
      }

      /* ================================================
         WISESUB EDUCATION
      ================================================= */

      else if (
        tab === "education"
      ) {
        if (!form.examProvider) {
          throw new Error(
            "Please select an education product."
          );
        }

        if (!form.plan) {
          throw new Error(
            "Please select an education package."
          );
        }

        response =
          await post(
            "/api/wisesub/purchase",
            {
              service_type:
                "education",

              provider_code:
                form.examProvider,

              package_code:
                form.plan,

              recipient:
                form.phone,

              quantity:
                Number(
                  form.quantity
                ) || 1,
	      pin: 
		form.pin,
            }
          );
      }

      /* ================================================
         RESPONSE
      ================================================= */

      console.log(
        "PURCHASE RESPONSE:",
        response
      );

      const purchaseData =
        response?.data;

      let successMessage =
        response?.message ||
        "Transaction submitted successfully.";

      if (
        purchaseData?.reference
      ) {
        successMessage +=
          ` Reference: ${purchaseData.reference}`;
      }

      /* Electricity token */

      if (
        purchaseData?.token
      ) {
        successMessage +=
          ` Token: ${purchaseData.token}`;
      }

      /* Education PIN cards */

      if (
        Array.isArray(
          purchaseData?.cards
        ) &&
        purchaseData.cards.length
      ) {
        successMessage +=
          " PIN(s) generated successfully.";
      }

      if (
        purchaseData?.purchased_code
      ) {
        successMessage +=
          ` ${purchaseData.purchased_code}`;
      }

      setMessage(
        successMessage
      );
    } catch (e: any) {
      console.error(
        "PURCHASE ERROR:",
        e
      );

      setError(
        e?.message ||
          "Transaction failed"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="shell page">

      {/* ===================================================
          HEADER
      ================================================== */}

      <div className="service-head">

        <div>
          <div className="eyebrow">
            DOZENTELECOM • VTU SERVICES
          </div>

          <h1>
            Buy a service
          </h1>

          <p className="muted">
            Live networks, plans and
            provider prices are loaded
            from the configured APIs.
          </p>
        </div>

        <a
          className="btn"
          href="/dashboard"
        >
          ← Dashboard
        </a>

      </div>

      {/* ===================================================
          TABS
      ================================================== */}

      <div className="service-tabs">

        {tabs.map(
          ([id, label, icon]) => (
            <button
              key={id}
              type="button"
              className={`tab ${
                tab === id
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                setTab(id);
                setError("");
                setMessage("");
              }}
            >
              {icon} {label}
            </button>
          )
        )}

      </div>

      {/* ===================================================
          ALERTS
      ================================================== */}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {/* ===================================================
          GRID
      ================================================== */}

      <div className="service-grid">

        <section className="card service-form">

          {/* =================================================
              AIRTIME
          ================================================ */}

          {tab === "airtime" && (
            <>
              <h2>
                📱 Airtime
              </h2>

              <label className="field">
                <span>
                  Network
                </span>

                <select
                  className="input"
                  value={
                    form.network
                  }
                  onChange={(e) =>
                    update(
                      "network",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select network
                  </option>

                  {networkOptions.map(
                    (network) => (
                      <option
                        key={
                          network.id
                        }
                        value={
                          network.id
                        }
                      >
                        {
                          network.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <Field
                label="Phone number"
                value={
                  form.phone
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "phone",
                    e.target.value
                  )
                }
                placeholder="08143140831"
                inputMode="numeric"
              />

              <Field
                label="Amount (₦)"
                value={
                  form.amount
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "amount",
                    e.target.value
                  )
                }
                type="number"
                min="50"
              />

              <Field
                label="4-digit PIN"
                value={
                  form.pin
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "pin",
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
            </>
          )}

          {/* =================================================
              DATA
          ================================================ */}

          {tab === "data" && (
            <>
              <h2>
                📶 Mobile Data
              </h2>

              <label className="field">
                <span>
                  Network
                </span>

                <select
                  className="input"
                  value={
                    form.network
                  }
                  onChange={(e) => {
                    update(
                      "network",
                      e.target.value
                    );

                    setServiceType(
                      ""
                    );

                    update(
                      "data_plan",
                      ""
                    );

                    update(
                      "amount",
                      ""
                    );
                  }}
                >
                  <option value="">
                    Select network
                  </option>

                  {networkOptions.map(
                    (network) => (
                      <option
                        key={
                          network.id
                        }
                        value={
                          network.id
                        }
                      >
                        {
                          network.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="field">
                <span>
                  Service type
                </span>

                <select
                  className="input"
                  value={
                    serviceType
                  }
                  disabled={
                    !form.network
                  }
                  onChange={(e) => {
                    setServiceType(
                      e.target.value
                    );

                    update(
                      "data_plan",
                      ""
                    );

                    update(
                      "amount",
                      ""
                    );
                  }}
                >
                  <option value="">
                    {!form.network
                      ? "Select a network first"
                      : "Select service type"}
                  </option>

                  {serviceTypes.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="field">
                <span>
                  Data plan
                </span>

                <select
                  className="input"
                  value={
                    form.data_plan
                  }
                  disabled={
                    !form.network ||
                    !serviceType
                  }
                  onChange={(e) => {
                    const selectedId =
                      e.target.value;

                    update(
                      "data_plan",
                      selectedId
                    );

                    const plan =
                      dataPlans.find(
                        (item) =>
                          item.key ===
                          selectedId
                      );

                    update(
  "amount",
  plan?.price ?? ""
);
                  }}
                >
                  <option value="">
                    {!form.network
                      ? "Select a network first"
                      : !serviceType
                      ? "Select a service type first"
                      : "Select a plan"}
                  </option>

                  {dataPlans
                    .filter(
                      (plan) =>
                        plan.networkId ===
                          String(
                            form.network
                          ) &&
                        plan.type ===
                          serviceType
                    )
                    .map(
                      (plan) => (
                        <option
                          key={
                            plan.key
                          }
                          value={
                            plan.key
                          }
                        >
                          {plan.name.trim()}
                          {" — ₦"}
                          {plan.price.toLocaleString()}
                          {" — "}
                          {plan.days}
                        </option>
                      )
                    )}
                </select>
              </label>

              <Field
                label="Phone number"
                value={
                  form.phone
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "phone",
                    e.target.value
                  )
                }
                placeholder="08143140831"
                inputMode="numeric"
              />

              <Field
                label="Amount (₦)"
                value={
                  form.amount
                }
                readOnly
              />

              <Field
                label="4-digit PIN"
                value={
                  form.pin
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "pin",
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
            </>
          )}

          {/* =================================================
              ELECTRICITY
          ================================================ */}

          {tab === "electricity" && (
            <>
              <h2>
                ⚡ Electricity
              </h2>

              <label className="field">
                <span>
                  Electricity Company
                </span>

                <select
                  className="input"
                  value={
                    form.provider
                  }
                  onChange={(e) =>
                    update(
                      "provider",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    {electricityProviders.length ===
                    0
                      ? "No electricity companies available"
                      : "Select electricity company"}
                  </option>

                  {electricityProviders.map(
                    (
                      provider: any,
                      index
                    ) => {
                      const code =
                        String(
                          provider?.provider_code ??
                            ""
                        ).trim();

                      const name =
                        String(
                          provider?.name ??
                            ""
                        ).trim();

                      if (
                        !code ||
                        !name
                      ) {
                        return null;
                      }

                      return (
                        <option
                          key={`electricity-${code}-${index}`}
                          value={code}
                        >
                          {name}
                        </option>
                      );
                    }
                  )}
                </select>
              </label>

              <label className="field">
                <span>
                  Meter type
                </span>

                <select
                  className="input"
                  value={
                    form.metertype
                  }
                  onChange={(e) =>
                    update(
                      "metertype",
                      e.target.value
                    )
                  }
                >
                  <option value="prepaid">
                    Prepaid
                  </option>

                  <option value="postpaid">
                    Postpaid
                  </option>
                </select>
              </label>

              <Field
                label="Meter number"
                value={
                  form.meternumber
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "meternumber",
                    e.target.value
                  )
                }
                placeholder="1111111111111"
                inputMode="numeric"
              />

              <button
                className="btn"
                type="button"
                onClick={
                  verifyElectricity
                }
                disabled={loading}
              >
                {loading
                  ? "Verifying..."
                  : "Verify meter"}
              </button>

              <Field
                label="Phone number"
                value={
                  form.phone
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "phone",
                    e.target.value
                  )
                }
                placeholder="08143140831"
                inputMode="numeric"
              />

              <Field
                label="Amount (₦)"
                value={
                  form.amount
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "amount",
                    e.target.value
                  )
                }
                type="number"
                min="100"
              />

              <Field
                label="4-digit PIN"
                value={
                  form.pin
                }
                onChange={(
                  e: any
                ) =>
                  update(
                    "pin",
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
            </>
          )}

          {/* =================================================
              CABLE TV
          ================================================ */}

          {tab === "cable" && (
  <>
    <h2>📺 Cable TV</h2>

    {/* PROVIDER */}
    <label className="field">
      <span>Provider</span>

      <select
        className="input"
        value={form.provider}
        onChange={e => {
          const provider = e.target.value;

          update("provider", provider);
          update("plan", "");
          update("amount", "");

          if (provider) {
            loadCablePlans(provider);
          } else {
            setCablePlans([]);
          }
        }}
        disabled={loading && cableProviders.length === 0}
      >
        <option value="">
          {cableProviders.length === 0
            ? "No cable providers available"
            : "Select provider"}
        </option>

        {cableProviders.map(
          (provider: any, index: number) => {
            const providerCode = String(
              provider?.provider_code ?? ""
            ).trim();

            const providerName = String(
              provider?.name ?? ""
            ).trim();

            if (!providerCode || !providerName) {
              return null;
            }

            return (
              <option
                key={`cable-provider-${providerCode}-${index}`}
                value={providerCode}
              >
                {providerName}
              </option>
            );
          }
        )}
      </select>
    </label>

    {/* IUC / SMART CARD */}
    <Field
      label="IUC / Smart-card number"
      value={form.iucnumber}
      onChange={(e: any) =>
        update(
          "iucnumber",
          e.target.value
        )
      }
      placeholder="1212121212"
      inputMode="numeric"
    />

    {/* VERIFY IUC */}
    <button
      className="btn"
      type="button"
      onClick={verifyCable}
      disabled={
        loading ||
        !form.provider ||
        !form.iucnumber
      }
    >
      {loading
        ? "Verifying..."
        : "Verify IUC"}
    </button>

    {/* CABLE PLAN */}
    <label className="field">
      <span>Plan</span>

      <select
        className="input"
        value={form.plan}
        disabled={
          !form.provider ||
          loading ||
          cablePlans.length === 0
        }
        onChange={e => {
          const selectedPlan =
            e.target.value;

          update(
            "plan",
            selectedPlan
          );

          const selectedPackage =
            cablePlans.find(
              (p: any) =>
                String(
                  p?.package_code ?? ""
                ) ===
                String(selectedPlan)
            );

          update(
  "amount",
  selectedPackage
    ? customerPrice(
        Number(
          selectedPackage?.price ?? 0
        ),
        "cable"
      )
    : ""
);
        }}
      >
        <option value="">
          {!form.provider
            ? "Select provider first"
            : loading
            ? "Loading cable plans..."
            : cablePlans.length === 0
            ? "No cable plans available"
            : "Select cable plan"}
        </option>

        {cablePlans.map(
          (
            plan: any,
            index: number
          ) => {
            const code = String(
              plan?.package_code ?? ""
            ).trim();

            const planName = String(
              plan?.package_name ??
                "Cable plan"
            ).trim();

            const cost = Number(
  plan?.price ?? 0
);

const price = customerPrice(
  cost,
  "cable"
);

            if (!code) {
              return null;
            }

            return (
              <option
                key={`cable-plan-${code}-${index}`}
                value={code}
              >
                {planName}
                {" — ₦"}
                {price.toLocaleString()}
              </option>
            );
          }
        )}
      </select>
    </label>

    {/* AMOUNT */}
    <Field
      label="Amount (₦)"
      value={form.amount}
      readOnly
    />

    {/* PHONE */}
    <Field
      label="Phone number"
      name="phone"
      value={form.phone || ""}
      onChange={(e: any) =>
        update(
          "phone",
          e.target.value.replace(/\D/g, "").slice(0, 11)
        )
      }
      placeholder="08143140831"
      type="tel"
  inputMode="numeric"
  autoComplete="tel"
    />

    {/* SUBSCRIPTION TYPE */}
    <label className="field">
      <span>Subscription type</span>

      <select
        className="input"
        value={form.subtype}
        onChange={e =>
          update(
            "subtype",
            e.target.value
          )
        }
      >
        <option value="renewal">
          Renewal
        </option>

        <option value="new">
          New
        </option>
      </select>
    </label>

    {/* PIN */}
    <Field
      label="4-digit PIN"
      value={form.pin}
      onChange={(e: any) =>
        update(
          "pin",
          e.target.value
            .replace(/\D/g, "")
            .slice(0, 4)
        )
      }
      type="password"
      inputMode="numeric"
      maxLength={4}
    />
  </>
)}

          {/* =================================================
              EDUCATION
          ================================================ */}

          {tab === "education" && (
  <>
    <h2>🎓 Education / Exam PIN</h2>

    {/* EDUCATION PRODUCT / PROVIDER */}
    <label className="field">
      <span>Education product</span>

      <select
        className="input"
        value={form.examProvider}
        onChange={async (e) => {
          const provider = e.target.value;

          update("examProvider", provider);
          update("plan", "");
          update("amount", "");

          if (!provider) {
            setEducationPlans([]);
            return;
          }

          await loadEducationPlans(provider);
        }}
        disabled={loading}
      >
        <option value="">
          {educationProviders.length === 0
            ? "No education products available"
            : "Select education product"}
        </option>

        {educationProviders.map(
          (provider: any, index: number) => {
            const providerCode = String(
              provider?.provider_code ?? ""
            ).trim();

            const providerName = String(
              provider?.name ?? ""
            ).trim();

            if (!providerCode || !providerName) {
              return null;
            }

            return (
              <option
                key={`education-provider-${providerCode}-${index}`}
                value={providerCode}
              >
                {providerName}
              </option>
            );
          }
        )}
      </select>
    </label>

    {/* EDUCATION PACKAGE */}
    <label className="field">
      <span>Package</span>

      <select
        className="input"
        value={form.plan}
        disabled={
          !form.examProvider ||
          loading ||
          educationPlans.length === 0
        }
        onChange={(e) => {
          const packageCode = e.target.value;

          update("plan", packageCode);

          const selectedPackage =
            educationPlans.find(
              (item: any) =>
                String(item?.package_code ?? "") ===
                String(packageCode)
            );

          update(
            "amount",
            selectedPackage?.price ?? ""
          );
        }}
      >
        <option value="">
          {!form.examProvider
            ? "Select education product first"
            : loading
            ? "Loading packages..."
            : educationPlans.length === 0
            ? "No packages available"
            : "Select package"}
        </option>

        {educationPlans.map(
          (item: any, index: number) => {
            const packageCode = String(
              item?.package_code ?? ""
            ).trim();

            const packageName = String(
              item?.package_name ??
                item?.name ??
                "Education package"
            ).trim();

            const cost = Number(
  item?.price ?? 0
);

const price = customerPrice(
  cost,
  "education"
);

            if (!packageCode) {
              return null;
            }

            return (
              <option
                key={`education-package-${packageCode}-${index}`}
                value={packageCode}
              >
                {packageName} — ₦
                {price.toLocaleString()}
              </option>
            );
          }
        )}
      </select>
    </label>

    {/* PHONE NUMBER */}
    <Field
      label="Phone number"
      name="phone"
      value={form.phone || ""}
      onChange={(e: any) =>
        update("phone", e.target.value
  .replace(/\D/g, "")
  .slice(0, 11)
	)
      }
      placeholder="08143140831"
      type="tel"
  inputMode="numeric"
  autoComplete="tel"
    />

    {/* QUANTITY */}
    <Field
      label="Quantity"
      value={form.quantity}
      onChange={(e: any) =>
        update("quantity", e.target.value)
      }
      type="number"
      min="1"
      max="20"
    />

    {/* AMOUNT */}
    <div className="field">
  <span>Amount</span>

  <div className="input">
    ₦{" "}
    {customerPrice(
      Number(
        educationPlans.find(
          (item: any) =>
            String(
              item?.package_code ?? ""
            ) ===
            String(form.plan)
        )?.price ?? 0
      ),
      "education"
    ) *
      (Number(form.quantity) || 1)}
  </div>
</div>

    {/* PIN */}
    <Field
      label="4-digit PIN"
      value={form.pin}
      onChange={(e: any) =>
        update(
          "pin",
          e.target.value
            .replace(/\D/g, "")
            .slice(0, 4)
        )
      }
      type="password"
      inputMode="numeric"
      maxLength={4}
    />
  </>
)}

          {/* =================================================
              PURCHASE BUTTON
          ================================================ */}

          <button
            className="btn primary buy"
            type="button"
            onClick={buy}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : "Confirm & purchase"}
          </button>

        </section>

        {/* =================================================
            SIDE PANEL
        ================================================ */}

        <aside className="card side">

          <h3>
            Security
          </h3>

          <p className="muted">
            Purchases are sent through
            secure server-side API
            routes. Provider API keys
            and customer PINs are never
            exposed to the browser.
          </p>

          <a
            className="btn"
            href="/forgot-pin"
          >
            Forgot PIN?
          </a>

          <hr />

          <h3>
            Providers
          </h3>

          <p className="muted">
            SME API:
            <br />
            Airtime & Data
            <br />
            <br />
            WISESUB:
            <br />
            Electricity
            <br />
            Cable TV
            <br />
            Education / Exam PIN
          </p>

        </aside>

      </div>
    </main>
  );
}