"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const services = [
  {
    name: "Airtime",
    href: "/dashboard/services?service=airtime",
    icon: "📱",
  },
  {
    name: "Data",
    href: "/dashboard/services?service=data",
    icon: "📶",
  },
  {
    name: "Electricity",
    href: "/dashboard/services?service=electricity",
    icon: "⚡",
  },
  {
    name: "Cable TV",
    href: "/dashboard/services?service=cable",
    icon: "📺",
  },
  {
    name: "Education",
    href: "/dashboard/services?service=education",
    icon: "🎓",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  const [open, setOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);

  return (
    <>
      {open && (
        <button
          type="button"
          className="admin-sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`admin-sidebar ${
          open ? "open" : "closed"
        }`}
      >
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-brand">
            Dozen<span>telecom</span>
          </div>

          <button
            type="button"
            className="admin-sidebar-toggle"
            onClick={() => setOpen(!open)}
            aria-label={
              open
                ? "Close sidebar"
                : "Open sidebar"
            }
          >
            {open ? "‹" : "›"}
          </button>
        </div>

        <div className="admin-label">
          {open && "ADMIN PANEL"}
        </div>

        <nav className="admin-sidebar-nav">

          {/* CUSTOMER VIEW */}
          <Link
            href="/dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "12px 14px",
              marginTop: "10px",
              borderRadius: "10px",
              background: "#f3f4f6",
              color: "#111827",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "14px",
              border: "1px solid #e5e7eb",
            }}
          >
            <span>👤</span>

            {open && (
              <span>
                Customer View
              </span>
            )}
          </Link>

          {/* DASHBOARD */}
          <Link
            href="/admin"
            className={`admin-sidebar-link ${
              pathname === "/admin"
                ? "active"
                : ""
            }`}
            title="Dashboard"
          >
            <span className="admin-sidebar-icon">
              🏠
            </span>

            {open && (
              <span>
                Dashboard
              </span>
            )}
          </Link>

          {/* CUSTOMERS */}
          <Link
            href="/admin/customers"
            className={`admin-sidebar-link ${
              pathname.startsWith(
                "/admin/customers"
              )
                ? "active"
                : ""
            }`}
            title="Customers"
          >
            <span className="admin-sidebar-icon">
              👥
            </span>

            {open && (
              <span>
                Customers
              </span>
            )}
          </Link>

          {/* TRANSACTIONS */}
          <Link
            href="/admin/transactions"
            className={`admin-sidebar-link ${
              pathname.startsWith(
                "/admin/transactions"
              )
                ? "active"
                : ""
            }`}
            title="Transactions"
          >
            <span className="admin-sidebar-icon">
              💳
            </span>

            {open && (
              <span>
                Transactions
              </span>
            )}
          </Link>

          {/* NOTIFICATIONS */}
          <Link
            href="/admin/notifications"
            className={`admin-sidebar-link ${
              pathname.startsWith(
                "/admin/notifications"
              )
                ? "active"
                : ""
            }`}
            title="Notifications"
          >
            <span className="admin-sidebar-icon">
              🔔
            </span>

            {open && (
              <span>
                Notifications
              </span>
            )}
          </Link>

          {/* PRICING & SETTINGS */}
          <Link
            href="/admin/settings"
            className={`admin-sidebar-link ${
              pathname.startsWith(
                "/admin/settings"
              )
                ? "active"
                : ""
            }`}
            title="Pricing and Settings"
          >
            <span className="admin-sidebar-icon">
              ⚙️
            </span>

            {open && (
              <span>
                Pricing & Settings
              </span>
            )}
          </Link>

          {/* PROFIT & WITHDRAW */}
          <Link
            href="/admin/profit"
            className={`admin-sidebar-link ${
              pathname.startsWith(
                "/admin/profit"
              )
                ? "active"
                : ""
            }`}
            title="Profit & Withdraw"
          >
            <span className="admin-sidebar-icon">
              💰
            </span>

            {open && (
              <span>
                Profit & Withdraw
              </span>
            )}
          </Link>

        </nav>

        {/* LOGOUT */}
        <div className="admin-sidebar-bottom">
          <a
            href="/api/auth/logout"
            className="admin-sidebar-link admin-logout"
            title="Logout"
          >
            <span className="admin-sidebar-icon">
              🚪
            </span>

            {open && (
              <span>
                Logout
              </span>
            )}
          </a>
        </div>
      </aside>

      {!open && (
        <button
          type="button"
          className="admin-sidebar-open"
          onClick={() => setOpen(true)}
          aria-label="Open admin sidebar"
        >
          ☰
        </button>
      )}
    </>
  );
}