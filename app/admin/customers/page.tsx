"use client";

import { useEffect, useState } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BackButton from "@/components/dashboard/BackButton";

type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  vipLevel: string;
  blocked: boolean;
  kycStatus: string;
  kycType: string;
  createdAt: string | null;
  wallet: {
    balanceKobo: number;
    currency: string;
  };
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function AdminCustomersPage() {
  const [users, setUsers] = useState<User[]>([]);

  const [pagination, setPagination] =
    useState<Pagination>({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });

  const [search, setSearch] = useState("");
  const [vipLevel, setVipLevel] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadUsers(page = 1) {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (vipLevel) {
        params.set("vipLevel", vipLevel);
      }

      params.set("page", String(page));
      params.set("limit", "25");

      const response = await fetch(
        `/api/admin/users?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load customers"
        );
      }

      setUsers(data.users || []);

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
        "ADMIN CUSTOMERS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Unable to load customers"
      );

      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers(1);
  }, [vipLevel]);

  function handleSearch(
    event: React.FormEvent
  ) {
    event.preventDefault();
    loadUsers(1);
  }

  async function toggleCustomerBlock(
    user: User
  ) {
    if (updatingId) return;

    const nextBlocked = !user.blocked;

    const confirmed = window.confirm(
      nextBlocked
        ? `Are you sure you want to block ${user.name || "this customer"}?`
        : `Are you sure you want to unblock ${user.name || "this customer"}?`
    );

    if (!confirmed) return;

    try {
      setUpdatingId(user.id);
      setError("");

      const response = await fetch(
        `/api/admin/users/${user.id}/block`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            blocked: nextBlocked,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Failed to update customer status"
        );
      }

      const updatedBlocked =
        data?.customer?.blocked === true;

      setUsers((currentUsers) =>
        currentUsers.map((item) =>
          item.id === user.id
            ? {
                ...item,
                blocked: updatedBlocked,
              }
            : item
        )
      );
    } catch (err: any) {
      console.error(
        "CUSTOMER BLOCK UPDATE ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to update customer status"
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function formatMoney(
    kobo: number
  ) {
    return `₦${(
      Number(kobo || 0) / 100
    ).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(
    date: string | null
  ) {
    if (!date) return "-";

    return new Date(date).toLocaleString(
      "en-NG",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  }

  function vipClass(
    level: string
  ) {
    return `admin-customer-vip ${level.toLowerCase()}`;
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

          <h1>Customers</h1>

          <p className="muted">
            View and manage registered
            customers.
          </p>
        </div>

        {/* FILTERS */}

        <div className="card admin-customer-filters">
          <form
            onSubmit={handleSearch}
            className="admin-customer-filter-form"
          >
            <div className="admin-filter-field">
              <label htmlFor="customer-search">
                Search
              </label>

              <input
                id="customer-search"
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Name, email or phone"
              />
            </div>

            <div className="admin-filter-field">
              <label htmlFor="customer-vip">
                VIP Level
              </label>

              <select
                id="customer-vip"
                value={vipLevel}
                onChange={(event) =>
                  setVipLevel(
                    event.target.value
                  )
                }
              >
                <option value="">
                  All customers
                </option>

                <option value="NORMAL">
                  Normal
                </option>

                <option value="VIP1">
                  VIP1
                </option>

                <option value="VIP2">
                  VIP2
                </option>

                <option value="VIP3">
                  VIP3
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
              Unable to complete request
            </strong>

            <p className="muted">
              {error}
            </p>

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                loadUsers(
                  pagination.page
                )
              }
            >
              Try again
            </button>
          </div>
        )}

        {/* CUSTOMER LIST */}

        <div className="card">
          <div className="admin-transaction-header">
            <div>
              <h2>
                Customer Accounts
              </h2>

              <p className="muted">
                {pagination.total.toLocaleString(
                  "en-NG"
                )}{" "}
                customer
                {pagination.total === 1
                  ? ""
                  : "s"}{" "}
                found
              </p>
            </div>
          </div>

          {loading ? (
            <div className="admin-transaction-empty">
              <p className="muted">
                Loading customers...
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="admin-transaction-empty">
              <h3>
                No customers found
              </h3>

              <p className="muted">
                Try changing your search
                or VIP filter.
              </p>
            </div>
          ) : (
            <div className="admin-customer-list">
              {users.map((user) => (
                <div
                  className="admin-customer-item"
                  key={user.id}
                >
                  <div className="admin-customer-main">
                    <div className="admin-customer-name-row">
                      <strong>
                        {user.name ||
                          "Unnamed customer"}
                      </strong>

                      <span
                        className={vipClass(
                          user.vipLevel
                        )}
                      >
                        {user.vipLevel}
                      </span>

                      {/* ACCOUNT STATUS */}

                      <span
                        style={{
                          display:
                            "inline-flex",
                          alignItems:
                            "center",
                          padding:
                            "4px 9px",
                          borderRadius:
                            "999px",
                          fontSize:
                            "12px",
                          fontWeight: 700,
                          backgroundColor:
                            user.blocked
                              ? "#fee2e2"
                              : "#dcfce7",
                          color:
                            user.blocked
                              ? "#b91c1c"
                              : "#15803d",
                        }}
                      >
                        {user.blocked
                          ? "BLOCKED"
                          : "ACTIVE"}
                      </span>
                    </div>

                    <div className="admin-customer-contact">
                      {user.email && (
                        <span>
                          {user.email}
                        </span>
                      )}

                      {user.phone && (
                        <span>
                          {user.phone}
                        </span>
                      )}
                    </div>

                    <div className="admin-customer-meta">
                      <span>
                        KYC:{" "}
                        <strong>
                          {user.kycStatus}
                        </strong>
                      </span>

                      <span>
                        Joined:{" "}
                        {formatDate(
                          user.createdAt
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="admin-customer-wallet">
                    <span className="muted">
                      Wallet Balance
                    </span>

                    <strong>
                      {formatMoney(
                        user.wallet
                          ?.balanceKobo || 0
                      )}
                    </strong>

                    {/* BLOCK / UNBLOCK */}

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={
                        updatingId ===
                        user.id
                      }
                      onClick={() =>
                        toggleCustomerBlock(
                          user
                        )
                      }
                      style={{
                        marginTop:
                          "10px",
                        width:
                          "100%",
                        borderColor:
                          user.blocked
                            ? "#16a34a"
                            : "#dc2626",
                        color:
                          user.blocked
                            ? "#15803d"
                            : "#b91c1c",
                      }}
                    >
                      {updatingId ===
                      user.id
                        ? "Updating..."
                        : user.blocked
                        ? "Unblock Account"
                        : "Block Account"}
                    </button>
                  </div>
                </div>
              ))}
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
                    pagination.page <= 1
                  }
                  onClick={() =>
                    loadUsers(
                      pagination.page - 1
                    )
                  }
                >
                  Previous
                </button>

                <span className="muted">
                  Page{" "}
                  {pagination.page} of{" "}
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
                    loadUsers(
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