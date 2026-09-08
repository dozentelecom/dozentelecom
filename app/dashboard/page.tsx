import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import CreatePinPopup from "./CreatePinPopup";
import GenerateAccountButton from "./GenerateAccountButton";
import NotificationBell from "@/components/notifications/NotificationBell";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const id = await currentUserId();

  if (!id) {
    redirect("/login");
  }

  await db();

  const u: any = await User.findById(id).lean();

  const w: any = await Wallet.findOne({
    userId: id,
  }).lean();

  return (
    <main className="dashboard-layout">
      <DashboardSidebar />

      <section className="dashboard-content">

        <div className="dashboard-top">
          <div>
            <p className="muted">
              Welcome back
            </p>

            <h1>
              Dashboard
            </h1>
          </div>

          <NotificationBell />
        </div>

        <div className="dashboard-summary-grid">

          {/* WALLET */}
          <div className="card">

            <div className="muted">
              Wallet balance
            </div>

            <h2>
              ₦
              {(
                (w?.balanceKobo || 0) / 100
              ).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                }
              )}
            </h2>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "12px",
              }}
            >
              <Link
                className="btn primary"
                href="/dashboard/fund"
              >
                Fund wallet
              </Link>

              <Link
                className="btn"
                href="/dashboard/withdrawal"
              >
                Withdraw
              </Link>
            </div>

          </div>

          {/* KYC / VIRTUAL ACCOUNT */}
          <div className="card">

            {u?.kyc?.status === "VERIFIED" ? (

              <>

{/* ACCOUNT HAS BEEN GENERATED */}
{u?.kyc?.accountNumber ? (

  <div
    style={{
      marginTop: "0",
      padding: "20px",
      borderRadius: "16px",
      color: "#ffffff",
    }}
  >

    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >

      <div>

        {/* VIRTUAL ACCOUNT LABEL */}
        <div
          style={{
            fontSize: "13px",
            color: "#cbd5e1",
            marginBottom: "5px",
          }}
        >
          Virtual Account
        </div>

        {/* BANK NAME */}
        <div
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {u?.kyc?.bankName || "Paystack-Titan"}
        </div>

      </div>

      {/* ACCOUNT STATUS */}
      {u?.kyc?.dvaStatus && (
        <div
          style={{
            whiteSpace: "nowrap",
            fontSize: "12px",
            fontWeight: 600,
            color:
              u.kyc.dvaStatus === "ACTIVE"
                ? "#22c55e"
                : "#f59e0b",
          }}
        >
          {u.kyc.dvaStatus === "ACTIVE"
            ? "● Account Active"
            : `● ${u.kyc.dvaStatus}`}
        </div>
      )}

    </div>

    {/* ACCOUNT NUMBER */}
    <div
      style={{
        marginTop: "24px",
        fontSize: "30px",
        lineHeight: 1.1,
        fontWeight: 800,
        letterSpacing: "2px",
        color: "#ffffff",
      }}
    >
      {u.kyc.accountNumber}
    </div>

    {/* ACCOUNT NAME */}
    <div
      style={{
        marginTop: "10px",
        fontSize: "14px",
        fontWeight: 600,
        color: "#e2e8f0",
        textTransform: "uppercase",
      }}
    >
      {u?.kyc?.accountName ||
        u?.name ||
        ""}
    </div>

  </div>

) : u?.kyc?.dvaStatus === "PENDING" ? (



                  /* ACCOUNT GENERATION IS STILL PROCESSING */
                  <div
                    style={{
                      marginTop: "0",
                      padding: "18px",
                      borderRadius: "12px",
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                    }}
                  >

                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      ⏳ Account generation in progress
                    </h3>

                    <p className="muted">
                      Your Paystack virtual account is
                      being generated.
                    </p>

                    <p
                      className="muted"
                      style={{
                        fontSize: "13px",
                      }}
                    >
                      This usually completes automatically.
                      Please refresh the page in a moment.
                    </p>

                    <Link
                      href="/dashboard"
                      className="btn"
                    >
                      Refresh
                    </Link>

                  </div>

                ) : (

                  /* VERIFIED BUT ACCOUNT HAS NOT BEEN REQUESTED YET */
                  <div
                    style={{
                      marginTop: "0",
                    }}
                  >

                    <p className="muted">
                      Generate your dedicated Paystack
                      virtual account.
                    </p>

                    <GenerateAccountButton />

                    <p
                      className="muted"
                      style={{
                        fontSize: "12px",
                        marginTop: "10px",
                      }}
                    >
                      Your account number will appear here
                      after Paystack completes the assignment.
                    </p>

                  </div>

                )}

              </>

            ) : (

              /* KYC NOT VERIFIED */
              <>
                <h3>
                  Identity verification required
                </h3>

                <p className="muted">
                  Verify NIN or BVN before generating
                  your wallet account number.
                </p>

                <Link
                  className="btn"
                  href="/kyc"
                >
                  Verify KYC
                </Link>
              </>

            )}

          </div>

        </div>

        {/* SERVICES */}

        <div className="section-head">

          <div>
            <h2>
              Services
            </h2>
          </div>

          <Link
            className="btn primary"
            href="/dashboard/services"
          >
            Open services
          </Link>

        </div>

        <div className="service-card-grid">

          {[
            ["Airtime", "📱"],
            ["Data", "📶"],
            ["Electricity", "⚡"],
            ["Education", "🎓"],
            ["Airtime to Cash", "💸"],
            ["Giveaway", "🎁"],
          ].map(([x, icon]) => (

            <Link
              href={
                x === "Airtime to Cash"
                  ? "/dashboard/airtime-to-cash"
                  : x === "Giveaway"
                  ? "/dashboard/giveaway"
                  : "/dashboard/services"
              }
              className="card service-card"
              key={x}
            >

              <div className="service-icon">
                {icon}
              </div>

              <h3>
                {x}
              </h3>

              <p className="muted">
                {x === "Giveaway"
                  ? "Send Airtime or Data as a gift"
                  : "Open secure form"}
              </p>

            </Link>

          ))}

        </div>

        {/* CONTACT & COMMUNITY */}

        <div className="section-head">

          <div>

            <h2>
              Contact & Community
            </h2>

            <p className="muted">
              Need help? Contact our support team or
              join our WhatsApp community.
            </p>

          </div>

        </div>

        <div className="contact-grid">

          {/* WHATSAPP ADMIN */}
          <a
            href="https://wa.me/2348143140831"
            target="_blank"
            rel="noopener noreferrer"
            className="card service-card"
          >

            <div className="service-icon">
              💬
            </div>

            <h3>
              Chat with Admin
            </h3>

            <p className="muted">
              Message us directly on WhatsApp
            </p>

          </a>

          {/* WHATSAPP GROUP */}
          <a
            href="https://chat.whatsapp.com/Euf9WLOfbIGD1BzH4c4jVE"
            target="_blank"
            rel="noopener noreferrer"
            className="card service-card"
          >

            <div className="service-icon">
              👥
            </div>

            <h3>
              Join WhatsApp Group
            </h3>

            <p className="muted">
              Join our community for updates and
              announcements
            </p>

          </a>

          {/* EMAIL SUPPORT */}
          <a
            href="mailto:ajibadeayodeji07@gmail.com"
            className="card service-card"
          >

            <div className="service-icon">
              ✉️
            </div>

            <h3>
              Email Support
            </h3>

            <p className="muted">
              Contact our support team by email
            </p>

          </a>

        </div>

      </section>
    </main>
  );
}