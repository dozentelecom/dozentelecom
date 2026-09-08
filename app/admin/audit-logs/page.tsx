"use client";

import { useEffect, useState } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import BackButton from "@/components/dashboard/BackButton";

type AuditLog = {
  id: string;

  action: string;

  targetType: string;

  targetId: string | null;

  description: string;

  previousValue: unknown;

  newValue: unknown;

  ipAddress: string | null;

  userAgent: string | null;

  createdAt: string | null;

  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] =
    useState<AuditLog[]>([]);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });

  const [search, setSearch] =
    useState("");

  const [action, setAction] =
    useState("");

  const [targetType, setTargetType] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadLogs(
    page = 1
  ) {
    try {
      setLoading(true);
      setError("");

      const params =
        new URLSearchParams();

      if (search.trim()) {
        params.set(
          "search",
          search.trim()
        );
      }

      if (action) {
        params.set(
          "action",
          action
        );
      }

      if (targetType) {
        params.set(
          "targetType",
          targetType
        );
      }

      params.set(
        "page",
        String(page)
      );

      params.set(
        "limit",
        "25"
      );

      const response =
        await fetch(
          `/api/admin/audit-logs?${params.toString()}`,
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load audit logs"
        );
      }

      setLogs(
        data.logs || []
      );

      setPagination(
        data.pagination || {
          page,
          limit: 25,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err: any) {
      console.error(
        "AUDIT LOG PAGE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load audit logs"
      );

      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs(1);
  }, [
    action,
    targetType,
  ]);

  function handleSearch(
    event: React.FormEvent
  ) {
    event.preventDefault();

    loadLogs(1);
  }

  function formatDate(
    value:
      | string
      | null
  ) {
    if (!value) {
      return "—";
    }

    return new Date(
      value
    ).toLocaleString(
      "en-NG",
      {
        dateStyle:
          "medium",
        timeStyle:
          "short",
      }
    );
  }

  function formatAction(
    value: string
  ) {
    return value
      .replace(
        /[_-]/g,
        " "
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <BackButton />

        <div className="admin-dashboard-top">
          <div className="eyebrow">
            ADMIN PANEL
          </div>

          <h1>
            Audit Logs
          </h1>

          <p className="muted">
            Track administrative
            actions performed
            across the platform.
          </p>
        </div>

        {/* FILTERS */}

        <div className="card admin-audit-filters">
          <form
            onSubmit={
              handleSearch
            }
            className="admin-audit-filter-form"
          >
            <div className="admin-filter-field">
              <label>
                Search
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search action, description or ID"
              />
            </div>

            <div className="admin-filter-field">
              <label>
                Action
              </label>

              <select
                value={action}
                onChange={(event) =>
                  setAction(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  All actions
                </option>

                <option value="BLOCK_USER">
                  Block User
                </option>

                <option value="UNBLOCK_USER">
                  Unblock User
                </option>

                <option value="CHANGE_VIP">
                  Change VIP
                </option>

                <option value="WALLET_ADJUSTMENT">
                  Wallet Adjustment
                </option>

                <option value="BLOCK_SERVICE">
                  Block Service
                </option>

                <option value="UNBLOCK_SERVICE">
                  Unblock Service
                </option>

                <option value="BLOCK_PROVIDER">
                  Block Provider
                </option>

                <option value="UNBLOCK_PROVIDER">
                  Unblock Provider
                </option>

                <option value="BLOCK_PLAN">
                  Block Plan
                </option>

                <option value="UNBLOCK_PLAN">
                  Unblock Plan
                </option>

                <option value="UPDATE_PRICING">
                  Update Pricing
                </option>
              </select>
            </div>

            <div className="admin-filter-field">
              <label>
                Target
              </label>

              <select
                value={
                  targetType
                }
                onChange={(event) =>
                  setTargetType(
                    event.target
                      .value
                  )
                }
              >
                <option value="">
                  All targets
                </option>

                <option value="USER">
                  User
                </option>

                <option value="WALLET">
                  Wallet
                </option>

                <option value="SERVICE">
                  Service
                </option>

                <option value="PROVIDER">
                  Provider
                </option>

                <option value="PLAN">
                  Plan
                </option>

                <option value="PRICING">
                  Pricing
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="primary-button"
            >
              Search
            </button>
          </form>
        </div>

        {/* ERROR */}

        {error && (
          <div className="card admin-transaction-error">
            <strong>
              Unable to load audit logs
            </strong>

            <p className="muted">
              {error}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadLogs(
                  pagination.page
                )
              }
            >
              Try again
            </button>
          </div>
        )}

        {/* LOG LIST */}

        <div className="card">
          <div className="admin-transaction-header">
            <div>
              <h2>
                Activity Log
              </h2>

              <p className="muted">
                {pagination.total.toLocaleString(
                  "en-NG"
                )}{" "}
                record
                {pagination.total ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="admin-transaction-empty">
              <p className="muted">
                Loading audit logs...
              </p>
            </div>
          ) : logs.length ===
            0 ? (
            <div className="admin-transaction-empty">
              <h3>
                No audit logs found
              </h3>

              <p className="muted">
                Administrative
                actions will appear
                here once they are
                performed.
              </p>
            </div>
          ) : (
            <div className="admin-audit-list">
              {logs.map(
                (log) => (
                  <div
                    className="admin-audit-item"
                    key={
                      log.id
                    }
                  >
                    <div className="admin-audit-main">
                      <div className="admin-audit-title">
                        <strong>
                          {formatAction(
                            log.action
                          )}
                        </strong>

                        <span className="admin-audit-target">
                          {
                            log.targetType
                          }
                        </span>
                      </div>

                      <p>
                        {
                          log.description
                        }
                      </p>

                      <div className="admin-audit-meta">
                        <span>
                          Admin:{" "}
                          <strong>
                            {log
                              .admin
                              ?.name ||
                              "Unknown"}
                          </strong>
                        </span>

                        {log.targetId && (
                          <span>
                            Target:{" "}
                            {
                              log.targetId
                            }
                          </span>
                        )}

                        <span>
                          {formatDate(
                            log.createdAt
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="admin-audit-side">
                      {log.ipAddress && (
                        <span className="muted">
                          IP:{" "}
                          {
                            log.ipAddress
                          }
                        </span>
                      )}

                      {log.admin
                        ?.email && (
                        <span className="muted">
                          {
                            log
                              .admin
                              .email
                          }
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* PAGINATION */}

          {!loading &&
            pagination.totalPages >
              1 && (
              <div className="admin-transaction-pagination">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    pagination.page <=
                    1
                  }
                  onClick={() =>
                    loadLogs(
                      pagination.page -
                        1
                    )
                  }
                >
                  Previous
                </button>

                <span className="muted">
                  Page{" "}
                  {
                    pagination.page
                  }{" "}
                  of{" "}
                  {
                    pagination.totalPages
                  }
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    pagination.page >=
                    pagination.totalPages
                  }
                  onClick={() =>
                    loadLogs(
                      pagination.page +
                        1
                    )
                  }
                >
                  Next
                </button>
              </div>
            )}
        </div>
      </main>
    </div>
  );
}