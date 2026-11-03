
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const NETWORKS: Record<string, string> = {
  "1": "MTN",
  "2": "AIRTEL",
  "3": "GLO",
  "4": "9MOBILE",
};

type Plan = {
  key: string;
  networkId: string;
  network: string;
  name: string;
  type: string;
  days: string;
  price: number;
};

function money(amount: number) {
  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dataRate, setDataRate] = useState<number | null>(null);
  const [network, setNetwork] = useState("ALL");
  const [serviceType, setServiceType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPricing() {
      setLoading(true);
      setError("");

      try {
        const [plansResponse, pricingResponse] =
          await Promise.all([
            fetch("/api/sme/data-plans", {
              cache: "no-store",
            }),
            fetch("/api/pricing", {
              cache: "no-store",
            }),
          ]);

        const plansData = await plansResponse.json();
        const pricingData = await pricingResponse.json();

        if (!plansResponse.ok || !plansData.success) {
          throw new Error(
            plansData.error || "Unable to load available data plans."
          );
        }

        if (!pricingResponse.ok) {
          throw new Error(
            pricingData.error || "Unable to load current pricing."
          );
        }

        const rate = Number(pricingData?.rates?.data);

        if (!Number.isFinite(rate)) {
          throw new Error("Unable to determine current data pricing.");
        }

        const receivedPlans = Array.isArray(plansData.plans)
          ? plansData.plans
          : [];

        const normalized: Plan[] = receivedPlans
          .map((p: any, index: number) => {
            const cost = Number(
              p?.price ??
                p?.amount ??
                p?.selling_price ??
                p?.cost ??
                0
            );

            const networkId = String(
              p?.networkId ?? p?.network_id ?? ""
            ).trim();

            const name = String(
              p?.name ??
                p?.plan_name ??
                p?.plan ??
                "Data plan"
            ).trim();

            const type = String(
              p?.type ??
                p?.plan_type ??
                p?.service_type ??
                p?.serviceType ??
                p?.datagroup ??
                ""
            ).trim();

            const days = String(
              p?.days ??
                p?.validity ??
                p?.duration ??
                ""
            ).trim();

            if (
              !NETWORKS[networkId] ||
              !Number.isFinite(cost) ||
              cost <= 0
            ) {
              return null;
            }

            // Same customer-price calculation as the dashboard.
            const sellingPrice =
              Math.ceil(cost * (1 + rate / 100) * 100) / 100;

            return {
              key: `${networkId}-${type}-${name}-${index}`,
              networkId,
              network: NETWORKS[networkId],
              name,
              type,
              days,
              price: sellingPrice,
            };
          })
          .filter((p: Plan | null): p is Plan => p !== null);

        if (active) {
          setDataRate(rate);
          setPlans(normalized);
        }
      } catch (e: any) {
        if (active) {
          setError(
            e?.message || "Unable to load data pricing."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPricing();

    return () => {
      active = false;
    };
  }, []);

  const networkOptions = useMemo(
    () =>
      Object.entries(NETWORKS).filter(([id]) =>
        plans.some((p) => p.networkId === id)
      ),
    [plans]
  );

  const serviceTypes = useMemo(() => {
    return [
      ...new Set(
        plans
          .filter(
            (p) =>
              network === "ALL" ||
              p.networkId === network
          )
          .map((p) => p.type)
          .filter(Boolean)
      ),
    ].sort();
  }, [plans, network]);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return plans
      .filter(
        (p) =>
          network === "ALL" || p.networkId === network
      )
      .filter(
        (p) =>
          serviceType === "ALL" ||
          p.type === serviceType
      )
      .filter(
        (p) =>
          !query ||
          p.name.toLowerCase().includes(query) ||
          p.network.toLowerCase().includes(query) ||
          p.type.toLowerCase().includes(query)
      )
      .sort((a, b) => a.price - b.price);
  }, [plans, network, serviceType, search]);

  return (
    <main className="shell page">
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 30,
        }}
      >
        <Link
          href="/"
          style={{
            fontSize: 21,
            fontWeight: 900,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          Dozen<span style={{ color: "#2563eb" }}>telecom</span>
        </Link>

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/login" className="btn">
            Login
          </Link>
          <Link href="/register" className="btn primary">
            Register
          </Link>
        </div>
      </nav>

      <section style={{ marginBottom: 25 }}>
        <div className="eyebrow">
          DOZENTELECOM • DATA PRICING
        </div>

        <h1 style={{ marginBottom: 8 }}>
          Data Plans & Prices
        </h1>

        <p className="muted">
          Compare available MTN, Airtel, Glo and 9mobile
          data plans before creating your account.
          The prices displayed are our customer prices.
        </p>
      </section>

      {loading && (
        <div className="card">
          Loading available data plans and prices...
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
          <button
            className="btn"
            type="button"
            style={{ marginLeft: 12 }}
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <section
            className="card"
            style={{
              marginBottom: 20,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
            }}
          >
            <label className="field">
              <span>Network</span>
              <select
                className="input"
                value={network}
                onChange={(e) => {
                  setNetwork(e.target.value);
                  setServiceType("ALL");
                }}
              >
                <option value="ALL">All networks</option>
                {networkOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Service type</span>
              <select
                className="input"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
              >
                <option value="ALL">All service types</option>
                {serviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Search plans</span>
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. 1GB, 5GB..."
              />
            </label>
          </section>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <strong>
              {filteredPlans.length} available data plans
            </strong>
            <span className="muted" style={{ fontSize: 13 }}>
              Prices in Nigerian Naira
            </span>
          </div>

          {filteredPlans.length === 0 ? (
            <div className="card">
              No available plans match your selection.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(230px, 1fr))",
                gap: 14,
              }}
            >
              {filteredPlans.map((plan) => (
                <article
                  className="card"
                  key={plan.key}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <strong>{plan.network}</strong>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "5px 9px",
                        borderRadius: 20,
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        fontWeight: 700,
                      }}
                    >
                      {plan.type || "Data"}
                    </span>
                  </div>

                  <h3 style={{ margin: 0 }}>
                    {plan.name}
                  </h3>

                  <div className="muted" style={{ fontSize: 13 }}>
                    Validity: {plan.days || "As specified by provider"}
                  </div>

                  <div
                    style={{
                      fontSize: 23,
                      fontWeight: 900,
                      marginTop: 3,
                    }}
                  >
                    {money(plan.price)}
                  </div>

                  <Link
                    href="/register"
                    className="btn primary"
                    style={{
                      display: "block",
                      textAlign: "center",
                      marginTop: "auto",
                    }}
                  >
                    Register to buy
                  </Link>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <section
        className="card"
        style={{
          marginTop: 28,
          textAlign: "center",
        }}
      >
        <h2>Ready to buy data?</h2>
        <p className="muted">
          Create your Dozentelecom account to access your wallet
          and purchase available data plans.
        </p>

        <Link href="/register" className="btn primary">
          Create your account
        </Link>

        <p style={{ marginTop: 12, fontSize: 13 }}>
          Already registered? <Link href="/login">Login here</Link>
        </p>
      </section>

      <footer
        className="footer"
        style={{ marginTop: 25 }}
      >
        Dozentelecom • Secure VTU services
      </footer>
    </main>
  );
  }
          
