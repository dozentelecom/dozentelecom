"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
    name: "Education / Exam PIN",
    href: "/dashboard/services?service=education",
    icon: "🎓",
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

  const [open, setOpen] = useState(true);
  const [servicesOpen, setServicesOpen] = useState(true);

  /*
   * Keep the first server/client render identical.
   * We only decide whether the user is admin after hydration.
   */
  const [isAdmin, setIsAdmin] = useState<boolean | null>(
    null
  );

  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadUserRole() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          if (mounted) {
            setIsAdmin(false);
          }

          return;
        }

        const data = await response.json();

        if (mounted) {
          setIsAdmin(data?.role === "admin");
        }
      } catch (error) {
        console.error(
          "Unable to load user role:",
          error
        );

        if (mounted) {
          setIsAdmin(false);
        }
      }
    }

    loadUserRole();

    return () => {
      mounted = false;
    };
  }, []);

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

      alert(
        "Unable to logout. Please try again."
      );
    }
  }

  const servicesActive =
    pathname.startsWith("/dashboard/services") ||
    pathname.startsWith(
      "/dashboard/airtime-to-cash"
    );

  return (
    <>
      {/* MOBILE OVERLAY */}

      {open && (
        <button
          type="button"
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside
        className={`dashboard-sidebar ${
          open ? "open" : "closed"
        }`}
      >
        {/* HEADER */}

        <div className="sidebar-header">
          <div className="sidebar-brand">
            Dozen<span>telecom</span>
          </div>

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
            {open ? "‹" : "›"}
          </button>
        </div>

        {/* NAVIGATION */}

        <nav className="sidebar-nav">
          {/* ADMIN */}

          {isAdmin === true && (
            <Link
              href="/admin"
              className={`sidebar-link ${
                pathname.startsWith("/admin")
                  ? "active"
                  : ""
              }`}
              title="Admin Panel"
            >
              <span className="sidebar-icon">
                🛠️
              </span>

              {open && (
                <span>
                  Admin Panel
                </span>
              )}
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
            title="Dashboard"
          >
            <span className="sidebar-icon">
              🏠
            </span>

            {open && (
              <span>
                Dashboard
              </span>
            )}
          </Link>

          {/* SERVICES */}

          <button
            type="button"
            className={`sidebar-link sidebar-service-button ${
              servicesActive
                ? "active"
                : ""
            }`}
            onClick={() =>
              setServicesOpen(
                !servicesOpen
              )
            }
            title="Services"
          >
            <span className="sidebar-icon">
              🛒
            </span>

            {open && (
              <>
                <span className="sidebar-service-title">
                  Services
                </span>

                <span className="sidebar-arrow">
                  {servicesOpen
                    ? "⌄"
                    : "›"}
                </span>
              </>
            )}
          </button>

          {/* SERVICE LIST */}

          {open && servicesOpen && (
            <div className="sidebar-services">
              {services.map((service) => (
                <Link
                  key={service.href}
                  href={service.href}
                  className="sidebar-service-link"
                >
                  <span>
                    {service.icon}
                  </span>

                  <span>
                    {service.name}
                  </span>
                </Link>
              ))}
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
            title="Giveaway"
          >
            <span className="sidebar-icon">
              🎁
            </span>

            {open && (
              <span>
                Giveaway
              </span>
            )}
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
            title="Fund Wallet"
          >
            <span className="sidebar-icon">
              💰
            </span>

            {open && (
              <span>
                Fund Wallet
              </span>
            )}
          </Link>

          {/* WITHDRAW */}

          <Link
            href="/dashboard/withdrawal"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/withdrawal"
              )
                ? "active"
                : ""
            }`}
            title="Withdraw"
          >
            <span className="sidebar-icon">
              🏦
            </span>

            {open && (
              <span>
                Withdraw
              </span>
            )}
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
            title="Transactions"
          >
            <span className="sidebar-icon">
              📋
            </span>

            {open && (
              <span>
                Transactions
              </span>
            )}
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
            title="Profile"
          >
            <span className="sidebar-icon">
              👤
            </span>

            {open && (
              <span>
                Profile
              </span>
            )}
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
            title="Reset PIN"
          >
            <span className="sidebar-icon">
              🔐
            </span>

            {open && (
              <span>
                Reset PIN
              </span>
            )}
          </Link>

          {/* KYC */}

          <Link
            href="/kyc"
            className={`sidebar-link ${
              pathname.startsWith("/kyc")
                ? "active"
                : ""
            }`}
            title="KYC Verification"
          >
            <span className="sidebar-icon">
              🪪
            </span>

            {open && (
              <span>
                KYC Verification
              </span>
            )}
          </Link>

          {/* SETTINGS */}

          <Link
            href="/dashboard/settings"
            className={`sidebar-link ${
              pathname.startsWith(
                "/dashboard/settings"
              )
                ? "active"
                : ""
            }`}
            title="Settings"
          >
            <span className="sidebar-icon">
              ⚙️
            </span>

            {open && (
              <span>
                Settings
              </span>
            )}
          </Link>
        </nav>

        {/* LOGOUT */}

        <div className="sidebar-bottom">
          <button
            type="button"
            className="sidebar-link logout"
            title="Logout"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{
              width: "100%",
              border: "none",
              background: "transparent",
              cursor: loggingOut
                ? "wait"
                : "pointer",
              opacity: loggingOut ? 0.6 : 1,
            }}
          >
            <span className="sidebar-icon">
              🚪
            </span>

            {open && (
              <span>
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* OPEN BUTTON */}

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
    </>
  );
}