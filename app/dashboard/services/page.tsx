"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   AVAILABLE SERVICE
========================================================= */

type Tab = "data";

const tabs: [Tab, string, string][] = [
  ["data", "Data", "📶"],
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
  body: Record<string, any>
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
  const [tab] = useState<Tab>("data");

  /* =======================================================
     DATA PLANS
  ======================================================= */

  const [plans, setPlans] =
    useState<any[]>([]);

  /* =======================================================
     DATA PRICING
  ======================================================= */

  const [dataRate, setDataRate] =
    useState(0);

  /* =======================================================
     STATE
  ======================================================= */

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
  useState("");

const [receipt, setReceipt] =
  useState<any>(null);

  const [serviceType, setServiceType] =
    useState("");

  /* =======================================================
     FORM
  ======================================================= */

  const [form, setForm] = useState({
    network: "",
    data_plan: "",
    phone: "",
    amount: "",
    pin: "",
  });

  const update = (
    key: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  /* =======================================================
     CUSTOMER SELLING PRICE
  ======================================================= */

  function customerPrice(cost: number) {
    const amount =
      Number(cost) || 0;

    const rate =
      Number(dataRate) || 0;

    return (
      Math.ceil(
        amount *
          (1 + rate / 100) *
          100
      ) / 100
    );
  }

  /* =======================================================
     DATA PLAN NORMALIZATION
  ======================================================= */

  const dataPlans = useMemo(() => {
    return plans.map(
      (p: any, index: number) => {
        const cost = Number(
          p?.price ??
            p?.amount ??
            p?.selling_price ??
            p?.cost ??
            0
        );

        return {
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

          cost,

          price: customerPrice(cost),

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
        };
      }
    );
  }, [plans, dataRate]);

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
     LOAD DATA PLANS
  ======================================================= */

  useEffect(() => {
    loadInitial();
  }, []);

  async function loadInitial() {
    setLoading(true);
    setError("");

    try {
      /* ================================================
         LOAD DATA PRICING
      ================================================= */

      try {
        const pricingResponse =
          await api("/api/pricing");

        const loadedRates =
          pricingResponse?.rates;

        if (loadedRates) {
          setDataRate(
            Number(
              loadedRates.data ?? 0
            )
          );
        }
      } catch (pricingError) {
        console.error(
          "DATA PRICING LOAD ERROR:",
          pricingError
        );
      }

      /* ================================================
         SME DATA PLANS
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
    } catch (e: any) {
      console.error(
        "DATA CATALOG LOAD ERROR:",
        e
      );

      setError(
        e?.message ||
          "Unable to load data plans"
      );
    } finally {
      setLoading(false);
    }
  }

/* =======================================================
   BUY DATA
======================================================= */

async function buy() {
  setLoading(true);
  setError("");
  setMessage("");
  setReceipt(null);

  try {
    if (!form.network) {
      throw new Error("Please select a network.");
    }

    if (!form.data_plan) {
      throw new Error("Please select a data plan.");
    }

    if (!form.phone) {
      throw new Error("Please enter the phone number.");
    }

    if (!/^\d{11}$/.test(form.phone)) {
      throw new Error(
        "Please enter a valid 11-digit phone number."
      );
    }

    if (!form.pin || form.pin.length !== 4) {
      throw new Error("Please enter your 4-digit PIN.");
    }

    /*
     * Do NOT use the generic post() helper here.
     *
     * A failed/pending provider transaction may still
     * contain useful transaction information even when
     * the API responds with HTTP 4xx/5xx.
     */
    const response = await fetch("/api/sme/data", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        network: Number(form.network),
        data_plan: Number(form.data_plan),
        phone: form.phone,
        pin: form.pin,
      }),
    });

    const json = await response
      .json()
      .catch(() => ({}));

    console.log(
      "DATA PURCHASE HTTP STATUS:",
      response.status
    );

    console.log(
      "DATA PURCHASE RESPONSE:",
      json
    );

    /*
     * Provider / API response can be either at the
     * root or inside data.
     */
    const purchaseData =
      json?.data &&
      typeof json.data === "object"
        ? json.data
        : {};

    const reference =
      json?.reference ||
      purchaseData?.reference ||
      json?.transactionReference ||
      purchaseData?.transactionReference ||
      json?.externalReference ||
      purchaseData?.externalReference ||
      "";

    const selectedPlan = dataPlans.find(
      (item) =>
        item.key === form.data_plan
    );

    /*
     * =====================================================
     * NORMALIZE STATUS
     * =====================================================
     */

    const rawStatus = String(
      json?.status ||
        purchaseData?.status ||
        json?.transactionStatus ||
        purchaseData?.transactionStatus ||
        ""
    ).toUpperCase();

    let status:
      | "SUCCESS"
      | "FAILED"
      | "PROCESSING";

    if (
      json?.success === false ||
      rawStatus === "FAILED" ||
      rawStatus === "FAILURE" ||
      rawStatus === "ERROR" ||
      rawStatus === "REVERSED" ||
      rawStatus === "CANCELLED"
    ) {
      status = "FAILED";
    } else if (
      rawStatus === "PENDING" ||
      rawStatus === "PROCESSING" ||
      rawStatus === "IN_PROGRESS"
    ) {
      status = "PROCESSING";
    } else if (
      json?.success === true ||
      rawStatus === "SUCCESS" ||
      rawStatus === "SUCCESSFUL" ||
      rawStatus === "COMPLETED" ||
      rawStatus === "COMPLETE"
    ) {
      status = "SUCCESS";
    } else if (!response.ok) {
      /*
       * If the server returned an error HTTP status but
       * supplied no explicit status, treat it as FAILED
       * so the customer still gets a receipt/result.
       */
      status = "FAILED";
    } else {
      /*
       * A successful HTTP response without a final status
       * is treated as processing rather than silently
       * disappearing.
       */
      status = "PROCESSING";
    }

    /*
     * =====================================================
     * MESSAGE / ERROR
     * =====================================================
     */

    const transactionMessage =
      json?.message ||
      json?.error ||
      purchaseData?.message ||
      purchaseData?.error ||
      json?.detail ||
      "";

	if (
  response.status === 400 &&
  String(transactionMessage).toLowerCase().includes("sme api request failed")
) {
  transactionMessage =
    "The number you entered is not eligible for this data plan.";
}

    /*
     * =====================================================
     * REFUND STATUS
     * =====================================================
     */

    const refunded = Boolean(
      json?.refunded ||
        purchaseData?.refunded
    );

    /*
     * =====================================================
     * ALWAYS SHOW RECEIPT
     *
     * SUCCESS / FAILED / PROCESSING
     * =====================================================
     */

    setReceipt({
      status,

      service: "DATA",

      network:
        networkOptions.find(
          (n) =>
            String(n.id) ===
            String(form.network)
        )?.name ||
        form.network,

      plan:
        selectedPlan?.name ||
        "Data Plan",

      planType:
        selectedPlan?.type ||
        serviceType,

      days:
        selectedPlan?.days ||
        "",

      phone:
        form.phone,

      amount:
        form.amount,

      reference,

      message:
        transactionMessage,

      refunded,

      createdAt:
        new Date().toLocaleString(
          "en-NG"
        ),
    });

    /*
     * =====================================================
     * PAGE MESSAGE
     * =====================================================
     */

    if (status === "SUCCESS") {
      setMessage(
        transactionMessage ||
          "Data purchase completed successfully."
      );
    } else if (status === "FAILED") {
      setMessage("");

      /*
       * Don't throw here.
       *
       * The receipt popup is now the place where the
       * failed transaction is displayed.
       */
    } else {
      setMessage(
        transactionMessage ||
          "Data purchase is still being processed."
      );
    }

    update("pin", "");
  } catch (e: any) {
    console.error(
      "DATA PURCHASE ERROR:",
      e
    );

    /*
     * This catch is now reserved for genuine frontend/
     * network failures where there is no usable transaction
     * response at all.
     */
    setError(
      e?.message ||
        "Unable to process data purchase."
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
            DOZENTELECOM • DATA SERVICES
          </div>

          <h1>
            Buy Mobile Data
          </h1>

          <p className="muted">
            Choose your network and data
            plan, then complete your
            purchase securely.
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

         <h2>
  📶 Mobile Data
</h2>

<div
  className="alert"
  style={{
    marginBottom: "14px",
    fontSize: "13px",
  }}
>
  ⚠️{" "}
  <strong>MTN Awoof Plans:</strong>{" "}
  Only eligible numbers can use Awoof plans. If an Awoof plan
  fails, please try another plan.
</div>

<div
  className="alert"
  style={{
    marginBottom: "14px",
    fontSize: "13px",
  }}
>
  ⚠️{" "}
  <strong>AIRTEL SME2:</strong>{" "}
  Only eligible numbers can use SME2. If SME2 fails, please try
  another plan.
</div>
          {/* NETWORK */}

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

                setServiceType("");

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

          {/* SERVICE TYPE */}

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

          {/* DATA PLAN */}

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
                  plan?.price
                    ? String(
                        plan.price
                      )
                    : ""
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

          {/* PHONE */}

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
                  .replace(
                    /\D/g,
                    ""
                  )
                  .slice(
                    0,
                    11
                  )
              )
            }
            placeholder="08143140831"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
          />

          {/* AMOUNT */}

          <Field
            label="Amount (₦)"
            value={
              form.amount
            }
            readOnly
          />

          {/* PIN */}

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
            autoComplete="off"
          />

          {/* PURCHASE BUTTON */}

          <button
            className="btn primary buy"
            type="button"
            onClick={buy}
            disabled={
              loading ||
              !form.network ||
              !form.data_plan ||
              !form.phone ||
              form.pin.length !== 4
            }
          >
            {loading
              ? "Processing..."
              : "Confirm & purchase"}
          </button>

        </section>

        {/* =================================================
            SIDE PANEL
        ================================================= */}

        <aside className="card side">

          <h3>
            Security
          </h3>

          <a
            className="btn"
            href="/forgot-pin"
          >
            Forgot PIN?
          </a>

        </aside>

      </div>
   {receipt && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(0,0,0,.65)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 500,
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#ffffff",
        color: "#111827",
        borderRadius: 18,
        padding: 24,
        boxSizing: "border-box",
        boxShadow: "0 20px 60px rgba(0,0,0,.35)",
      }}
    >
      <h2
        style={{
          marginTop: 0,
          marginBottom: 8,
          color: "#111827",
          fontSize: 24,
          fontWeight: 800,
        }}
      >
        Transaction Receipt
      </h2>

      <h3
        style={{
          marginTop: 8,
          marginBottom: 20,
          color:
            receipt.status === "SUCCESS"
              ? "#15803d"
              : receipt.status === "FAILED"
              ? "#dc2626"
              : "#b45309",
          fontSize: 20,
          fontWeight: 800,
        }}
      >
        {receipt.status === "SUCCESS"
          ? "Transaction Successful"
          : receipt.status === "FAILED"
          ? "Transaction Failed"
          : "Transaction Pending"}
      </h3>

     {receipt.status === "FAILED" && (
  <div
    style={{
      background: receipt.refunded
        ? "#ecfdf5"
        : "#fef2f2",
      color: receipt.refunded
        ? "#166534"
        : "#991b1b",
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 18,
      fontWeight: 700,
      lineHeight: 1.5,
    }}
  >
    {receipt.refunded
      ? "Transaction failed. Wallet refunded successfully."
      : "Transaction failed."}
  </div>
)}

      <p style={{ color: "#111827" }}>
        <strong>Service:</strong>{" "}
        Mobile Data
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Network:</strong>{" "}
        {receipt.network || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Data Plan:</strong>{" "}
        {receipt.plan || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Plan Type:</strong>{" "}
        {receipt.planType || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Validity:</strong>{" "}
        {receipt.days || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Phone:</strong>{" "}
        {receipt.phone || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Amount:</strong>{" "}
        ₦
        {Number(
          receipt.amount || 0
        ).toLocaleString("en-NG", {
          minimumFractionDigits: 2,
        })}
      </p>

      <p
        style={{
          color: "#111827",
          wordBreak: "break-word",
        }}
      >
        <strong>Reference:</strong>{" "}
        {receipt.reference || "—"}
      </p>

      <p style={{ color: "#111827" }}>
        <strong>Status:</strong>{" "}
        {receipt.status}
      </p>

      {receipt.message && (
        <p
          style={{
            color: "#111827",
            wordBreak: "break-word",
          }}
        >
          <strong>Message:</strong>{" "}
          {receipt.message}
        </p>
      )}

      {receipt.refunded && (
        <p
          style={{
            color: "#166534",
            fontWeight: 700,
          }}
        >
          <strong>Refund:</strong>{" "}
          Wallet refunded
        </p>
      )}

      <p style={{ color: "#111827" }}>
        <strong>Date:</strong>{" "}
        {receipt.createdAt}
      </p>

      <button
        type="button"
        className="btn primary"
        onClick={() => setReceipt(null)}
        style={{
          width: "100%",
          marginTop: 12,
        }}
      >
        Close Receipt
      </button>

      {receipt.reference && (
        <a
          href={`/dashboard/transactions/${encodeURIComponent(
            receipt.reference
          )}`}
          className="btn"
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            marginTop: 10,
            boxSizing: "border-box",
          }}
        >
          View Full Receipt
        </a>
      )}
    </div>
  </div>
)}

</main>
  );
}