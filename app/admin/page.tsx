"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import AdminSidebar from "@/components/admin/AdminSidebar";

type Range = "today" | "7d" | "30d";

type Analytics = {
  overview: {
    revenueKobo: number;
    providerCostKobo: number;
    profitKobo: number;
    profitMargin: number;
    transactionCount: number;
    successfulCount: number;
    failedCount: number;
    pendingCount: number;
  };

  services: {
    service: string;
    revenueKobo: number;
    costKobo: number;
    profitKobo: number;
    transactions: number;
  }[];

  daily: {
    date: string;
    revenueKobo: number;
    profitKobo: number;
    transactions: number;
  }[];
};

function naira(kobo: number) {
  return `₦${(
    Number(kobo || 0) / 100
  ).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function serviceName(service: string) {
  const names: Record<string, string> = {
    data: "Data",
    airtime: "Airtime",
    electricity: "Electricity",
    cable: "Cable TV",
    education: "Education",
  };

  return names[service] || service;
}

export default function AdminDashboard() {
  const [range, setRange] =
    useState<Range>("today");

  const [data, setData] =
    useState<Analytics | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadAnalytics(
    selectedRange: Range
  ) {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/admin/analytics?range=${selectedRange}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to load analytics"
        );
      }

      setData(result);
    } catch (error: any) {
      console.error(
        "ADMIN DASHBOARD ERROR:",
        error
      );

      setError(
        error?.message ||
          "Unable to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics(range);
  }, [range]);

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">

        {/* =====================================================
            HEADER
        ===================================================== */}

        <div className="admin-dashboard-top">
          <div>
            <div className="eyebrow">
              ADMINISTRATION
            </div>

            <h1>Admin Dashboard</h1>

            <p className="muted">
              Monitor revenue, transactions and
              platform profit.
            </p>
          </div>

          <div className="admin-analytics-actions">
            <Link
              href="/admin/customers"
              className="secondary-button"
            >
              Customers
            </Link>

            <Link
              href="/admin/transactions"
              className="secondary-button"
            >
              Transactions
            </Link>
          </div>
        </div>

        {/* =====================================================
            DATE RANGE
        ===================================================== */}

        <div className="admin-analytics-range">

          <button
            type="button"
            className={
              range === "today"
                ? "admin-range-button active"
                : "admin-range-button"
            }
            onClick={() =>
              setRange("today")
            }
          >
            Today
          </button>

          <button
            type="button"
            className={
              range === "7d"
                ? "admin-range-button active"
                : "admin-range-button"
            }
            onClick={() =>
              setRange("7d")
            }
          >
            Last 7 Days
          </button>

          <button
            type="button"
            className={
              range === "30d"
                ? "admin-range-button active"
                : "admin-range-button"
            }
            onClick={() =>
              setRange("30d")
            }
          >
            Last 30 Days
          </button>

        </div>

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="card admin-error-card">
            <h3>
              Unable to load analytics
            </h3>

            <p className="muted">
              {error}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                loadAnalytics(range)
              }
            >
              Try Again
            </button>
          </div>
        )}

        {/* =====================================================
            MAIN STATS
        ===================================================== */}

        <div className="admin-analytics-grid">

          <div className="admin-stat-card">
            <span>
              Total Revenue
            </span>

            <strong>
              {loading
                ? "Loading..."
                : naira(
                    data?.overview
                      .revenueKobo || 0
                  )}
            </strong>

            <small>
              Customer charges
            </small>
          </div>

          <div className="admin-stat-card">
            <span>
              Provider Cost
            </span>

            <strong>
              {loading
                ? "Loading..."
                : naira(
                    data?.overview
                      .providerCostKobo || 0
                  )}
            </strong>

            <small>
              Successful services
            </small>
          </div>

          <div className="admin-stat-card profit">
            <span>
              Gross Profit
            </span>

            <strong>
              {loading
                ? "Loading..."
                : naira(
                    data?.overview
                      .profitKobo || 0
                  )}
            </strong>

            <small>
              {data?.overview
                .profitMargin || 0}
              % profit margin
            </small>
          </div>

          <div className="admin-stat-card">
            <span>
              Transactions
            </span>

            <strong>
              {loading
                ? "Loading..."
                : (
                    data?.overview
                      .transactionCount || 0
                  ).toLocaleString()}
            </strong>

            <small>
              All transaction statuses
            </small>
          </div>

        </div>

        {/* =====================================================
            TRANSACTION STATUS
        ===================================================== */}

        <div className="admin-analytics-status-grid">

          <div className="admin-mini-stat">
            <span>
              Successful
            </span>

            <strong>
              {data?.overview
                .successfulCount || 0}
            </strong>
          </div>

          <div className="admin-mini-stat">
            <span>
              Failed
            </span>

            <strong>
              {data?.overview
                .failedCount || 0}
            </strong>
          </div>

          <div className="admin-mini-stat">
            <span>
              Pending
            </span>

            <strong>
              {data?.overview
                .pendingCount || 0}
            </strong>
          </div>

        </div>

        {/* =====================================================
            SERVICE PERFORMANCE
        ===================================================== */}

        <div className="card admin-analytics-card">

          <div className="admin-section-heading">
            <div>
              <h2>
                Service Performance
              </h2>

              <p className="muted">
                Revenue, provider cost and
                profit by service.
              </p>
            </div>
          </div>

          <div className="admin-service-table">

            <div className="admin-service-row admin-service-header">
              <span>
                Service
              </span>

              <span>
                Transactions
              </span>

              <span>
                Revenue
              </span>

              <span>
                Cost
              </span>

              <span>
                Profit
              </span>
            </div>

            {data?.services?.map(
              (service) => (
                <div
                  key={service.service}
                  className="admin-service-row"
                >
                  <strong>
                    {serviceName(
                      service.service
                    )}
                  </strong>

                  <span>
                    {service.transactions.toLocaleString()}
                  </span>

                  <span>
                    {naira(
                      service.revenueKobo
                    )}
                  </span>

                  <span>
                    {naira(
                      service.costKobo
                    )}
                  </span>

                  <strong className="profit-text">
                    {naira(
                      service.profitKobo
                    )}
                  </strong>
                </div>
              )
            )}

            {!loading &&
              data?.services?.length === 0 && (
                <p className="muted">
                  No service transactions
                  found for this period.
                </p>
              )}

          </div>
        </div>

        {/* =====================================================
            DAILY PERFORMANCE
        ===================================================== */}

        <div className="card admin-analytics-card">

          <div className="admin-section-heading">
            <div>
              <h2>
                Daily Performance
              </h2>

              <p className="muted">
                Daily revenue and profit for
                the selected period.
              </p>
            </div>
          </div>

          {data?.daily?.length ? (
            <div className="admin-daily-list">

              {data.daily.map((day) => (
                <div
                  key={day.date}
                  className="admin-daily-row"
                >
                  <div>
                    <strong>
                      {new Date(
                        `${day.date}T00:00:00`
                      ).toLocaleDateString(
                        "en-NG",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </strong>

                    <span>
                      {day.transactions}{" "}
                      transaction
                      {day.transactions === 1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {naira(
                        day.revenueKobo
                      )}
                    </strong>

                    <span>
                      Profit:{" "}
                      {naira(
                        day.profitKobo
                      )}
                    </span>
                  </div>
                </div>
              ))}

            </div>
          ) : (
            <p className="muted">
              {loading
                ? "Loading daily performance..."
                : "No successful transactions in this period."}
            </p>
          )}

        </div>

        {/* =====================================================
            QUICK ADMIN ACTIONS
        ===================================================== */}

        <div className="admin-quick-grid">

          <Link
            href="/admin/customers"
            className="card admin-quick-card"
          >
            <h3>
              👥 Customers
            </h3>

            <p className="muted">
              Manage registered customers,
              VIP levels and KYC information.
            </p>
          </Link>

          <Link
            href="/admin/transactions"
            className="card admin-quick-card"
          >
            <h3>
              💳 Transactions
            </h3>

            <p className="muted">
              Search and inspect customer
              service transactions.
            </p>
          </Link>

          <Link
            href="/admin/settings"
            className="card admin-quick-card"
          >
            <h3>
              💰 Pricing & Rates
            </h3>

            <p className="muted">
              Control normal and VIP service
              pricing.
            </p>
          </Link>

          <Link
            href="/admin/audit-logs"
            className="card admin-quick-card"
          >
            <h3>
              🛡️ Audit Logs
            </h3>

            <p className="muted">
              Review important administrator
              actions.
            </p>
          </Link>

        </div>

      </main>
    </div>
  );
}