import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import CreatePinPopup from "./CreatePinPopup";
import GenerateAccountButton from "./GenerateAccountButton";

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

            <Link
              className="btn primary"
              href="/dashboard/fund"
            >
              Fund wallet
            </Link>

          </div>

          {/* KYC / VIRTUAL ACCOUNT */}
          <div className="card">

            {u?.kyc?.status === "VERIFIED" ? (
              <>

                <h3>
                  Identity verified
                </h3>

                <p className="muted">
                  Your identity has been successfully
                  verified.
                </p>

                {u?.kyc?.accountNumber ? (

                  /*
                   * ACCOUNT HAS BEEN GENERATED
                   */
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "18px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                    }}
                  >

                    <div
                      className="muted"
                      style={{
                        fontSize: "13px",
                        marginBottom: "6px",
                      }}
                    >
                      Virtual Account
                    </div>

                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        marginBottom: "5px",
                      }}
                    >
                      {u?.kyc?.bankName ||
                        "Paystack"}
                    </div>

                    <h2
                      style={{
                        margin: "4px 0",
                        letterSpacing: "1px",
                      }}
                    >
                      {u.kyc.accountNumber}
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                      }}
                    >
                      {u?.kyc?.accountName ||
                        u?.name ||
                        ""}
                    </p>

                    {u?.kyc?.dvaStatus && (
                      <div
                        style={{
                          marginTop: "10px",
                          fontSize: "12px",
                          color:
                            u.kyc.dvaStatus ===
                            "ACTIVE"
                              ? "#15803d"
                              : "#b45309",
                          fontWeight: 600,
                        }}
                      >
                        {u.kyc.dvaStatus ===
                        "ACTIVE"
                          ? "● Account Active"
                          : `● ${u.kyc.dvaStatus}`}
                      </div>
                    )}

                  </div>

                ) : u?.kyc?.dvaStatus === "PENDING" ? (

                  /*
                   * ACCOUNT GENERATION IS STILL PROCESSING
                   */
                  <div
                    style={{
                      marginTop: "18px",
                      padding: "18px",
                      borderRadius: "12px",
                      border:
                        "1px solid #fde68a",
                      background: "#fffbeb",
                    }}
                  >

                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      ⏳ Account generation
                      in progress
                    </h3>

                    <p className="muted">
                      Your Paystack virtual account
                      is being generated.
                    </p>

                    <p
                      className="muted"
                      style={{
                        fontSize: "13px",
                      }}
                    >
                      This usually completes
                      automatically. Please refresh
                      the page in a moment.
                    </p>

                    <Link
                      href="/dashboard"
                      className="btn"
                    >
                      Refresh
                    </Link>

                  </div>

                ) : (

                  /*
                   * VERIFIED BUT ACCOUNT HAS NOT
                   * BEEN REQUESTED YET
                   */
                  <div
                    style={{
                      marginTop: "18px",
                    }}
                  >

                    <p className="muted">
                      Generate your dedicated
                      Paystack virtual account.
                    </p>

                   <GenerateAccountButton />

                    <p
                      className="muted"
                      style={{
                        fontSize: "12px",
                        marginTop: "10px",
                      }}
                    >
                      Your account number will
                      appear here after Paystack
                      completes the assignment.
                    </p>

                  </div>

                )}

              </>
            ) : (

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

            <p className="muted">
              Protected VTU services with
              server-side PIN enforcement.
            </p>

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
          ].map(([x, icon]) => (

            <Link
              href={
                x === "Airtime to Cash"
                  ? "/dashboard/airtime-to-cash"
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
                Open secure form
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