"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const services = [
    {
    name: "Data",
    href: "/dashboard/services?service=data",
    icon: "📶",
  },
    {
    name: "Airtime to Cash",
    href: "/dashboard/airtime-to-cash",
    icon: "💸",
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [serviceQuery, setServiceQuery] = useState("");

  /*
   * =========================================================
   * CLIENT MOUNT
   * =========================================================
   */

  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * =========================================================
   * READ SERVICE QUERY AFTER MOUNT
   * =========================================================
   */

  useEffect(() => {
    if (!mounted) return;

    const updateQuery = () => {
      setServiceQuery(window.location.search);
    };

    updateQuery();

    window.addEventListener("popstate", updateQuery);

    return () => {
      window.removeEventListener("popstate", updateQuery);
    };
  }, [mounted, pathname]);

  /*
   * =========================================================
   * LOAD USER ROLE
   * =========================================================
   */

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    async function loadUserRole() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (!cancelled) {
            setIsAdmin(false);
          }

          return;
        }

        const data = await response.json();

        if (!cancelled) {
          setIsAdmin(data?.role === "admin");
        }
      } catch (error) {
        console.error("Unable to load user role:", error);

        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    }

    loadUserRole();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  /*
   * =========================================================
   * LOGOUT
   * =========================================================
   */

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to logout.");
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);

      setLoggingOut(false);

      alert("Unable to logout. Please try again.");
    }
  }

  /*
   * =========================================================
   * HYDRATION SHELL
   * =========================================================
   */

  if (!mounted) {
    return (
      <>
        <div
          className="sidebar-hydration-placeholder"
          aria-hidden="true"
        />

        <style>{`
         .sidebar-hydration-placeholder {
  width: 0;
  flex: 0 0 0;
  min-height: 100vh;
  background: transparent;
}

          @media (max-width: 900px) {
  .sidebar-hydration-placeholder {
    width: 0;
    flex: 0 0 0;
  }
}
        `}</style>
      </>
    );
  }

  /*
   * =========================================================
   * ACTIVE STATES
   * =========================================================
   */

  const servicesActive =
    pathname.startsWith("/dashboard/services") ||
    pathname.startsWith("/dashboard/airtime-to-cash");

  return (
    <>
      {/* MOBILE OVERLAY */}
      {open && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`dashboard-sidebar ${
          open ? "open" : "closed"
        }`}
      >
        {/* =====================================================
            BRAND
        ===================================================== */}

        <div className="sidebar-brand">
          <Link
            href="/dashboard"
            className="brand-link"
          >
            <span className="brand-dozen">
              Dozen
            </span>

            <span className="brand-telecom">
              telecom
            </span>
          </Link>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setOpen(!open)}
            aria-label={
              open
                ? "Close sidebar"
                : "Open sidebar"
            }
          >
            {open ? "←" : "→"}
          </button>
        </div>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <nav className="sidebar-nav">
          {/* ADMIN */}
          {isAdmin && (
            <Link
              href="/admin"
              className="sidebar-link admin-link"
            >
              <span className="sidebar-icon">
                🛠️
              </span>

              <span className="sidebar-text">
                Admin Panel
              </span>
            </Link>
          )}

          {/* DASHBOARD */}
          <Link
            href="/dashboard"
            className={`sidebar-link ${
              pathname === "/dashboard"
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              🏠
            </span>

            <span className="sidebar-text">
              Dashboard
            </span>
          </Link>

          {/* SERVICES */}
          <button
            type="button"
            className={`sidebar-link services-toggle ${
              servicesActive ? "active" : ""
            }`}
            onClick={() =>
              setServicesOpen(!servicesOpen)
            }
          >
            <span className="sidebar-icon">
              🛒
            </span>

            <span className="sidebar-text">
              Services
            </span>

            <span className="services-arrow">
              {servicesOpen ? "▾" : "▸"}
            </span>
          </button>

          {/* SERVICE LIST */}
          {servicesOpen && (
            <div className="services-list">
              {services.map((service) => {
                let active = false;

                if (
                  service.href.includes(
                    "service="
                  )
                ) {
                  const query =
                    service.href.split("?")[1];

                  active =
                    pathname ===
                      "/dashboard/services" &&
                    serviceQuery.includes(query);
                } else {
                  active =
                    pathname.startsWith(
                      "/dashboard/airtime-to-cash"
                    );
                }

                return (
                  <Link
                    key={service.href}
                    href={service.href}
                    className={`service-link ${
                      active ? "active" : ""
                    }`}
                  >
                    <span className="service-icon">
                      {service.icon}
                    </span>

                    <span>
                      {service.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* GIVEAWAY */}
          <Link
            href="/dashboard/giveaway"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/giveaway"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              🎁
            </span>

            <span className="sidebar-text">
              Giveaway
            </span>
          </Link>

          {/* FUND WALLET */}
          <Link
            href="/dashboard/fund"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/fund"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              💰
            </span>

            <span className="sidebar-text">
              Fund Wallet
            </span>
          </Link>

          {/* TRANSACTIONS */}
          <Link
            href="/dashboard/transactions"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/transactions"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              📋
            </span>

            <span className="sidebar-text">
              Transactions
            </span>
          </Link>

          {/* PROFILE */}
          <Link
            href="/dashboard/profile"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/profile"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              👤
            </span>

            <span className="sidebar-text">
              Profile
            </span>
          </Link>

          {/* RESET PIN */}
          <Link
            href="/dashboard/reset-pin"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/reset-pin"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              🔐
            </span>

            <span className="sidebar-text">
              Reset PIN
            </span>
          </Link>

          {/* KYC */}
          <Link
            href="/dashboard/kyc"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/kyc"
              )
                ? "active"
                : ""
            }`}
          >
            <span className="sidebar-icon">
              🪪
            </span>

            <span className="sidebar-text">
              KYC
            </span>
          </Link>

          {/* SETTINGS */}
<Link
  href="/dashboard/settings"
  className={`sidebar-link ${
    pathname.startsWith("/dashboard/settings")
      ? "active"
      : ""
  }`}
>
  <span className="sidebar-icon">
    ⚙️
  </span>

  <span className="sidebar-text">
    Settings
  </span>
</Link>

{/* LOGOUT */}
<button
  type="button"
  className="sidebar-link logout-button"
  onClick={handleLogout}
  disabled={loggingOut}
>
  <span className="sidebar-icon">
    🚪
  </span>

  <span className="sidebar-text">
    {loggingOut ? "Logging out..." : "Logout"}
  </span>
</button>

</nav>

</aside>

{/* =======================================================
    MOBILE OPEN BUTTON
======================================================= */}

{!open && (
  <button
    type="button"
    className="sidebar-open-button"
    onClick={() => setOpen(true)}
    aria-label="Open sidebar"
  >
    ☰
  </button>
)}

{/* =======================================================
    DARK BLUE SIDEBAR STYLES
======================================================= */}

<style>{`
  .dashboard-sidebar {
    width: 250px;
    min-width: 250px;
    height: 100vh;

    position: sticky;
    top: 0;
    left: 0;

    z-index: 1000;

    display: flex;
    flex-direction: column;

    background: #071a33;
    border-right: 1px solid #0b3a6f;

    transition:
      width 0.2s ease,
      min-width 0.2s ease,
      transform 0.2s ease;

    overflow-y: auto;
  }

        .dashboard-sidebar.closed {
          width: 0;
          min-width: 0;
          overflow: hidden;
          border: 0;
        }

        /* =====================================================
           BRAND
        ===================================================== */

        .sidebar-brand {
          height: 70px;
          padding: 0 14px 0 18px;

          display: flex;
          align-items: center;
          justify-content: space-between;

          border-bottom: 1px solid
            rgba(255, 255, 255, 0.12);

          flex-shrink: 0;
        }

        .brand-link {
          text-decoration: none;
          font-size: 21px;
          font-weight: 900;
          white-space: nowrap;
        }

        .brand-dozen {
          color: #ffffff;
        }

        .brand-telecom {
          color: #22c55e;
        }

        /* =====================================================
           TOGGLE
        ===================================================== */

        .sidebar-toggle {
          width: 34px;
          height: 34px;

          border: 0;
          border-radius: 8px;

          background: rgba(255, 255, 255, 0.10);
          color: #ffffff;

          cursor: pointer;
          font-size: 17px;

          flex-shrink: 0;
        }

        .sidebar-toggle:hover {
          background: rgba(255, 255, 255, 0.18);
        }

        /* =====================================================
           NAV
        ===================================================== */

        .sidebar-nav {
          flex: 1;
          padding: 14px 10px;
          overflow-y: auto;
        }

        .sidebar-link {
          width: 100%;
          min-height: 44px;

          padding: 10px 12px;
          margin-bottom: 4px;

          display: flex;
          align-items: center;
          gap: 11px;

          border-radius: 10px;
          border: 0;

          background: transparent;
          color: #dbeafe;

          text-decoration: none;

          font-size: 14px;
          font-weight: 600;

          text-align: left;

          cursor: pointer;
          box-sizing: border-box;
        }

        .sidebar-link:hover {
          background: rgba(255, 255, 255, 0.10);
          color: #ffffff;
        }

        .sidebar-link.active {
          background: #0d6efd;
          color: #ffffff;

          box-shadow:
            0 4px 12px
            rgba(0, 0, 0, 0.12);
        }

        /* =====================================================
           ADMIN
        ===================================================== */

        .admin-link {
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
        }

        .admin-link:hover {
          background: rgba(245, 158, 11, 0.25);
          color: #fcd34d;
        }

        /* =====================================================
           ICONS
        ===================================================== */

        .sidebar-icon {
          width: 22px;
          min-width: 22px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          font-size: 17px;
        }

        .sidebar-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* =====================================================
           SERVICES
        ===================================================== */

        .services-toggle {
          font-family: inherit;
        }

        .services-arrow {
          margin-left: auto;
          font-size: 15px;
          color: #bfdbfe;
        }

        .services-list {
          margin: 2px 0 8px 34px;
          padding-left: 8px;

          border-left: 1px solid
            rgba(255, 255, 255, 0.18);
        }

        .service-link {
          display: flex;
          align-items: center;
          gap: 8px;

          padding: 8px 10px;

          border-radius: 8px;

          color: #bfdbfe;

          text-decoration: none;

          font-size: 13px;
          font-weight: 600;

          line-height: 1.3;
        }

        .service-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .service-link.active {
          background: rgba(13, 110, 253, 0.35);
          color: #ffffff;
        }

        .service-icon {
          width: 20px;
          min-width: 20px;
          text-align: center;
        }

        /* =====================================================
           FOOTER
        ===================================================== */

        .sidebar-footer {
          padding: 10px;

          border-top: 1px solid
            rgba(255, 255, 255, 0.12);

          flex-shrink: 0;
        }

        .logout-button {
          width: 100%;
          min-height: 44px;

          padding: 10px 12px;

          display: flex;
          align-items: center;
          gap: 11px;

          border: 0;
          border-radius: 10px;

          background: transparent;
          color: #fca5a5;

          font-family: inherit;

          font-size: 14px;
          font-weight: 700;

          text-align: left;

          cursor: pointer;
        }

        .logout-button:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #fecaca;
        }

        .logout-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* =====================================================
           MOBILE OVERLAY
        ===================================================== */

        .sidebar-overlay {
          display: none;
        }

        /* =====================================================
           MOBILE OPEN BUTTON
        ===================================================== */

        .sidebar-open-button {
          position: fixed;

          top: 14px;
          left: 14px;

          z-index: 1100;

          width: 42px;
          height: 42px;

          border: 0;
          border-radius: 10px;

          background: #071a33;
          color: #ffffff;

          box-shadow:
            0 5px 20px
            rgba(15, 23, 42, 0.25);

          cursor: pointer;

          font-size: 20px;
        }

        .sidebar-open-button:hover {
          background: #0b3a6f;
        }

        /* =====================================================
           TABLET / MOBILE
        ===================================================== */

        @media (max-width: 900px) {
          .dashboard-sidebar {
            position: fixed;

            width: 270px;
            min-width: 270px;

            height: 100dvh;

            transform: translateX(0);

            box-shadow:
              8px 0 30px
              rgba(0, 0, 0, 0.25);
          }

          .dashboard-sidebar.closed {
            width: 270px;
            min-width: 270px;

            transform: translateX(-105%);

            overflow-y: auto;
          }

          .sidebar-overlay {
            display: block;

            position: fixed;
            inset: 0;

            z-index: 999;

            border: 0;

            background:
              rgba(0, 0, 0, 0.45);
          }
        }

        /* =====================================================
           SMALL PHONES
        ===================================================== */

        @media (max-width: 480px) {
          .dashboard-sidebar {
            width: min(86vw, 300px);
            min-width: min(86vw, 300px);
          }

          .dashboard-sidebar.closed {
            width: min(86vw, 300px);
            min-width: min(86vw, 300px);
          }
        }
      `}</style>

    </>
  );
}