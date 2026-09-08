"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Plan = {
  id: number;
  network_id: number;
  network: string;
  name: string;
  type: string;
  days: string;
  price: number;
};

type Controls = {
  sme_data_plans: Record<string, boolean>;
};

export default function AdminDataPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [controls, setControls] = useState<Controls>({
    sme_data_plans: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [network, setNetwork] = useState("ALL");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [plansRes, controlsRes] = await Promise.all([
        fetch("/api/sme/data-plans", {
          cache: "no-store",
        }),
        fetch("/api/admin/provider-controls", {
          cache: "no-store",
        }),
      ]);

      const plansData = await plansRes.json();
      const controlsData = await controlsRes.json();

      if (!plansRes.ok) {
        throw new Error(
          plansData?.error ||
            "Unable to load SME data plans"
        );
      }

      if (!controlsRes.ok) {
        throw new Error(
          controlsData?.error ||
            "Unable to load plan controls"
        );
      }

      setPlans(
        Array.isArray(plansData?.plans)
          ? plansData.plans
          : []
      );

      setControls({
        sme_data_plans:
          controlsData?.controls?.sme_data_plans || {},
      });
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to load data plans"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const networks = useMemo(() => {
    return Array.from(
      new Set(
        plans
          .map((plan) =>
            String(plan.network || "").toUpperCase()
          )
          .filter(Boolean)
      )
    );
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();

    return plans.filter((plan) => {
      const matchesNetwork =
        network === "ALL" ||
        String(plan.network).toUpperCase() === network;

      const matchesSearch =
        !query ||
        String(plan.id).includes(query) ||
        String(plan.name)
          .toLowerCase()
          .includes(query) ||
        String(plan.type)
          .toLowerCase()
          .includes(query) ||
        String(plan.days)
          .toLowerCase()
          .includes(query);

      return matchesNetwork && matchesSearch;
    });
  }, [plans, search, network]);

  async function togglePlan(plan: Plan) {
    if (saving !== null) return;

    const current =
      controls.sme_data_plans?.[
        String(plan.id)
      ] !== false;

    const next = !current;

    setSaving(plan.id);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/provider-controls",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sme_data_plans: {
              [String(plan.id)]: next,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to update plan"
        );
      }

      setControls({
        sme_data_plans:
          data?.controls?.sme_data_plans || {},
      });

      setMessage(
        `${plan.network} ${plan.name} ${
          next ? "enabled" : "disabled"
        } successfully.`
      );
    } catch (error: any) {
      setMessage(
        error?.message ||
          "Unable to update plan"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="admin-data-plans-page">
      <div className="admin-data-plans-header">
        <div>
          <Link
            href="/admin"
            className="admin-data-plans-back"
          >
            ← Back to Admin
          </Link>

          <h1>SME Data Plans</h1>

          <p>
            Manage individual SME data plans without
            disabling the entire network.
          </p>
        </div>
      </div>

      {message && (
        <div className="admin-data-plans-message">
          {message}
        </div>
      )}

      <div className="admin-data-plans-toolbar">
        <input
          type="text"
          placeholder="Search plan, ID, type..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="admin-data-plans-search"
        />

        <select
          value={network}
          onChange={(e) =>
            setNetwork(e.target.value)
          }
          className="admin-data-plans-select"
        >
          <option value="ALL">
            All Networks
          </option>

          {networks.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="admin-data-plans-loading">
          Loading SME data plans...
        </div>
      ) : (
        <>
          <div className="admin-data-plans-summary">
            Showing {filteredPlans.length} of{" "}
            {plans.length} plans
          </div>

          <div className="admin-data-plans-list">
            {filteredPlans.map((plan) => {
              const enabled =
                controls.sme_data_plans?.[
                  String(plan.id)
                ] !== false;

              const isSaving =
                saving === plan.id;

              return (
                <div
                  key={`${plan.network_id}-${plan.id}`}
                  className={`admin-data-plan-card ${
                    enabled
                      ? "enabled"
                      : "disabled"
                  }`}
                >
                  <div className="admin-data-plan-main">
                    <div className="admin-data-plan-network">
                      {plan.network}
                    </div>

                    <div className="admin-data-plan-details">
                      <h3>{plan.name}</h3>

                      <div className="admin-data-plan-meta">
                        <span>
                          ID: {plan.id}
                        </span>

                        <span>
                          {plan.type}
                        </span>

                        <span>
                          {plan.days}
                        </span>

                        <strong>
                          ₦
                          {Number(
                            plan.price || 0
                          ).toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="admin-data-plan-actions">
                    <span
                      className={`admin-data-plan-status ${
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

                    <button
                      type="button"
                      disabled={
                        saving !== null
                      }
                      onClick={() =>
                        togglePlan(plan)
                      }
                      className={`admin-data-plan-toggle ${
                        enabled
                          ? "disable"
                          : "enable"
                      }`}
                    >
                      {isSaving
                        ? "Saving..."
                        : enabled
                        ? "Disable"
                        : "Enable"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPlans.length === 0 && (
            <div className="admin-data-plans-empty">
              No data plans found.
            </div>
          )}
        </>
      )}
    </div>
  );
}