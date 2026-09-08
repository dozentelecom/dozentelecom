"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BackButton from "@/components/dashboard/BackButton";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vipLevel: string;
};

type Transaction = {
  _id?: string;
  externalReference?: string;
  providerTransactionId?: string;
  service?: string;
  status?: string;
  amountKobo?: number;
  costKobo?: number;
  profitKobo?: number;
  createdAt?: string;
  customer?: Customer | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [service, setService] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadTransactions(page = 1) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (status) {
        params.set("status", status);
      }

      if (service) {
        params.set("service", service);
      }

      params.set("page", String(page));
      params.set("limit", "25");

      const response = await fetch(
        `/api/admin/transactions?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load transactions"
        );
      }

      setTransactions(data.transactions || []);

      setPagination(
        data.pagination || {
          page,
          limit: 25,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err: any) {
      console.error("ADMIN TRANSACTIONS ERROR:", err);

      setError(
        err?.message || "Unable to load transactions"
      );

      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTransactions(1);
  }, [status, service]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadTransactions(1);
  }

  function formatMoney(kobo: number | undefined) {
    const amount = Number(kobo || 0) / 100;

    return `₦${amount.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(date?: string) {
    if (!date) return "-";

    return new Date(date).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatService(service?: string) {
    if (!service) return "Transaction";

    return service
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }

  function statusClass(status?: string) {
    return `transaction-status ${String(
      status || "unknown"
    ).toLowerCase()}`;
  }

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <BackButton />

        <div className="admin-dashboard-top">
          <div className="eyebrow">ADMIN PANEL</div>

          <h1>Transactions</h1>

          <p className="muted">
            Manage and monitor transactions made by all
            customers.
          </p>
        </div>

        {/* FILTERS */}

        <div className="card admin-transaction-filters">
          <form
            onSubmit={handleSearch}
            className="admin-transaction-filter-form"
          >
            <div className="admin-filter-field admin-filter-search">
              <label htmlFor="transaction-search">
                Search
              </label>

              <input
                id="transaction-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Reference, provider ID or service"
              />
            </div>

            <div className="admin-filter-field">
              <label htmlFor="transaction-status">
                Status
              </label>

              <select
                id="transaction-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
              >
                <option value="">All statuses</option>
                <option value="SUCCESS">
                  Success
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
                <option value="PENDING">
                  Pending
                </option>
                <option value="PROCESSING">
                  Processing
                </option>
                <option value="FAILED">
                  Failed
                </option>
                <option value="REVERSED">
                  Reversed
                </option>
              </select>
            </div>

            <div className="admin-filter-field">
              <label htmlFor="transaction-service">
                Service
              </label>

              <select
                id="transaction-service"
                value={service}
                onChange={(event) =>
                  setService(event.target.value)
                }
              >
                <option value="">All services</option>
                <option value="airtime">Airtime</option>
                <option value="data">Data</option>
                <option value="electricity">
                  Electricity
                </option>
                <option value="cable">Cable TV</option>
                <option value="education">
                  Education
                </option>
                <option value="airtimeToCash">
                  Airtime to Cash
                </option>
                <option value="funding">Funding</option>
                <option value="withdrawal">
                  Withdrawal
                </option>
              </select>
            </div>

            <button
              type="submit"
              className="primary-button admin-filter-button"
            >
              Search
            </button>
          </form>
        </div>

        {/* ERROR */}

        {error && (
          <div className="card admin-transaction-error">
            <strong>Unable to load transactions</strong>

            <p className="muted">{error}</p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadTransactions(pagination.page)
              }
            >
              Try again
            </button>
          </div>
        )}

        {/* RESULTS */}

        <div className="card">
          <div className="admin-transaction-header">
            <div>
              <h2>Transaction History</h2>

              <p className="muted">
                {pagination.total.toLocaleString("en-NG")}{" "}
                transaction
                {pagination.total === 1 ? "" : "s"} found
              </p>
            </div>
          </div>

          {loading ? (
            <div className="admin-transaction-empty">
              <p className="muted">
                Loading transactions...
              </p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="admin-transaction-empty">
              <h3>No transactions found</h3>

              <p className="muted">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="admin-transaction-list">
              {transactions.map((tx) => {
                const profit =
                  Number(tx.profitKobo || 0) / 100;

                return (
                  <div
                    className="admin-transaction-item"
                    key={
                      tx._id ||
                      tx.externalReference ||
                      Math.random()
                    }
                  >
                    <div className="admin-transaction-main">
                      {/* SERVICE */}

                      <div className="admin-transaction-service">
                        <strong>
                          {formatService(tx.service)}
                        </strong>

                        <span
                          className={statusClass(
                            tx.status
                          )}
                        >
                          {tx.status || "UNKNOWN"}
                        </span>
                      </div>

                      {/* CUSTOMER */}

                      <div className="admin-transaction-customer">
                        <strong>
                          {tx.customer?.name ||
                            "Unknown customer"}
                        </strong>

                        {tx.customer?.email && (
                          <span className="muted">
                            {tx.customer.email}
                          </span>
                        )}

                        {tx.customer?.phone && (
                          <span className="muted">
                            {tx.customer.phone}
                          </span>
                        )}

                        {tx.customer?.vipLevel && (
                          <span className="admin-vip-badge">
                            {tx.customer.vipLevel}
                          </span>
                        )}
                      </div>

                      {/* REFERENCES */}

                      <div className="admin-transaction-references">
                        <span className="transaction-reference">
                          Ref:{" "}
                          {tx.externalReference || "-"}
                        </span>

                        {tx.providerTransactionId && (
                          <span className="transaction-reference">
                            Provider:{" "}
                            {tx.providerTransactionId}
                          </span>
                        )}
                      </div>

                      {/* DATE */}

                      <span className="muted admin-transaction-date">
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>

                    {/* FINANCIAL DETAILS */}

                    <div className="admin-transaction-right">
                      <strong className="admin-transaction-amount">
                        {formatMoney(tx.amountKobo)}
                      </strong>

                      <div className="admin-transaction-financials">
                        <span>
                          Cost:{" "}
                          {formatMoney(tx.costKobo)}
                        </span>

                        <span
                          className={
                            profit >= 0
                              ? "admin-profit-positive"
                              : "admin-profit-negative"
                          }
                        >
                          Profit:{" "}
                          {formatMoney(tx.profitKobo)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAGINATION */}

          {!loading &&
            pagination.totalPages > 1 && (
              <div className="admin-transaction-pagination">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    loadTransactions(
                      pagination.page - 1
                    )
                  }
                >
                  Previous
                </button>

                <span className="muted">
                  Page {pagination.page} of{" "}
                  {pagination.totalPages}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    pagination.page >=
                    pagination.totalPages
                  }
                  onClick={() =>
                    loadTransactions(
                      pagination.page + 1
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