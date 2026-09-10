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
  })
    .sort({
      balanceKobo: -1,
    })
    .lean();

  return (
    <main className="dashboard-layout">
      <DashboardSidebar />

      <section className="dashboard-content">

        {/* =====================================================
            TOP BAR
        ===================================================== */}

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

        {/* =====================================================
            SUMMARY
        ===================================================== */}

        <div className="dashboard-summary-grid">

          {/* ===================================================
              WALLET
          =================================================== */}

          <div className="card wallet-card">

            <div className="muted">
              Wallet balance
            </div>

            <h2 className="wallet-balance">
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

            <div className="wallet-actions">
              <Link
                className="btn primary"
                href="/dashboard/fund"
              >
                Fund wallet
              </Link>
            </div>

          </div>

          {/* ===================================================
              KYC / VIRTUAL ACCOUNT
          =================================================== */}

          <div className="card virtual-account-card">

            {u?.kyc?.status === "VERIFIED" ? (

              <>

                {/* =================================================
                    ACCOUNT GENERATED
                ================================================= */}

                {u?.kyc?.accountNumber ? (

                  <div className="virtual-account-inner">

                    {/* ACCOUNT HEADER */}

                    <div className="virtual-account-header">

                      <div className="virtual-account-bank">

                        <div className="virtual-account-label">
                          Virtual Account
                        </div>

                        <div className="virtual-account-bank-name">
                          {u?.kyc?.bankName ||
                            "Paystack-Titan"}
                        </div>

                      </div>

                      {/* ACCOUNT STATUS */}

                      {u?.kyc?.dvaStatus && (
                        <div
                          className={`virtual-account-status ${
                            u.kyc.dvaStatus ===
                            "ACTIVE"
                              ? "active"
                              : "pending"
                          }`}
                        >
                          {u.kyc.dvaStatus ===
                          "ACTIVE"
                            ? "● Account Active"
                            : `● ${u.kyc.dvaStatus}`}
                        </div>
                      )}

                    </div>

                    {/* =================================================
                        ACCOUNT NUMBER
                    ================================================= */}

                    <div className="account-number-section">

                      <div className="account-number-label">
                        Account Number
                      </div>

                      <div
                        className="account-number"
                        title={u.kyc.accountNumber}
                      >
                        {u.kyc.accountNumber}
                      </div>

                    </div>

                    {/* =================================================
                        ACCOUNT NAME
                    ================================================= */}

                    <div className="account-name-section">

                      <div className="account-name-label">
                        Account Name
                      </div>

                      <div className="account-name">
                        {u?.kyc?.accountName ||
                          u?.name ||
                          ""}
                      </div>

                    </div>

                  </div>

                ) : u?.kyc?.dvaStatus === "PENDING" ? (

                  /* =================================================
                     ACCOUNT GENERATION PROCESSING
                  ================================================= */

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

                  /* =================================================
                     VERIFIED BUT ACCOUNT NOT GENERATED
                  ================================================= */

                  <div>
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

              /* ===================================================
                 KYC NOT VERIFIED
              =================================================== */

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

        {/* =====================================================
            SERVICES
        ===================================================== */}

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

        {/* =====================================================
            CONTACT & COMMUNITY
        ===================================================== */}

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

          {/* EMAIL */}

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

      {/* =======================================================
          RESPONSIVE DASHBOARD FIX
      ======================================================= */}

      <style>{`

        /* =====================================================
           PREVENT GLOBAL HORIZONTAL OVERFLOW
        ===================================================== */

        .dashboard-layout {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }

        .dashboard-content {
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
          box-sizing: border-box;
        }

        /* =====================================================
           SUMMARY GRID
        ===================================================== */

        .dashboard-summary-grid {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .dashboard-summary-grid > * {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* =====================================================
           WALLET
        ===================================================== */

        .wallet-card {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          box-sizing: border-box;
        }

        .wallet-balance {
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .wallet-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
        }

        .wallet-actions .btn {
          flex: 0 1 auto;
          max-width: 100%;
          box-sizing: border-box;
        }

        /* =====================================================
           VIRTUAL ACCOUNT CARD
        ===================================================== */

        .virtual-account-card {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          box-sizing: border-box;
        }

        .virtual-account-inner {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;

          padding: clamp(14px, 3vw, 20px);
          border-radius: 16px;

          color: #ffffff;

          overflow: hidden;
        }

        .virtual-account-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;

          gap: 12px;
          flex-wrap: wrap;

          width: 100%;
          min-width: 0;
        }

        .virtual-account-bank {
          min-width: 0;
          max-width: 100%;
          flex: 1 1 150px;
        }

        .virtual-account-label {
          font-size: 13px;
          color: #cbd5e1;
          margin-bottom: 5px;
        }

        .virtual-account-bank-name {
          font-size: clamp(15px, 2vw, 17px);
          font-weight: 700;
          color: #ffffff;

          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .virtual-account-status {
          flex: 0 1 auto;
          max-width: 100%;

          font-size: 12px;
          font-weight: 600;

          white-space: normal;
          overflow-wrap: anywhere;
        }

        .virtual-account-status.active {
          color: #22c55e;
        }

        .virtual-account-status.pending {
          color: #f59e0b;
        }

        /* =====================================================
           ACCOUNT NUMBER
        ===================================================== */

        .account-number-section {
          width: 100%;
          min-width: 0;

          margin-top: 20px;

          box-sizing: border-box;
        }

        .account-number-label {
          margin-bottom: 6px;

          font-size: 12px;
          font-weight: 600;

          color: #cbd5e1;
        }

        .account-number {
          width: 100%;
          max-width: 100%;
          min-width: 0;

          font-size: clamp(22px, 4vw, 30px);
          line-height: 1.25;
          font-weight: 800;

          letter-spacing: clamp(
            1px,
            0.3vw,
            2px
          );

          color: #ffffff;

          /*
           * IMPORTANT:
           * Never allow the account number to
           * push the card outside the screen.
           */

          overflow-wrap: anywhere;
          word-break: break-all;

          white-space: normal;

          box-sizing: border-box;
        }

        /* =====================================================
           ACCOUNT NAME
        ===================================================== */

        .account-name-section {
          width: 100%;
          min-width: 0;

          margin-top: 14px;

          box-sizing: border-box;
        }

        .account-name-label {
          margin-bottom: 4px;

          font-size: 12px;
          font-weight: 600;

          color: #cbd5e1;
        }

        .account-name {
          width: 100%;
          max-width: 100%;
          min-width: 0;

          font-size: clamp(
            13px,
            2vw,
            14px
          );

          line-height: 1.5;
          font-weight: 600;

          color: #e2e8f0;

          text-transform: uppercase;

          overflow-wrap: anywhere;
          word-break: break-word;

          white-space: normal;
        }

        /* =====================================================
           TABLET
        ===================================================== */

        @media (max-width: 900px) {

          .dashboard-content {
            width: 100%;
            max-width: 100%;
            min-width: 0;

            box-sizing: border-box;
          }

          .dashboard-summary-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          .virtual-account-inner {
            padding: 16px;
          }

          .account-number {
            font-size: clamp(
              21px,
              6vw,
              28px
            );
          }
        }

        /* =====================================================
           MOBILE
        ===================================================== */

        @media (max-width: 600px) {

          .dashboard-content {
            padding-left: 12px;
            padding-right: 12px;
          }

          .dashboard-top {
            min-width: 0;
            max-width: 100%;
          }

          .dashboard-top h1 {
            font-size: 25px;
          }

          .dashboard-summary-grid {
            gap: 12px;
          }

          .virtual-account-inner {
            padding: 14px;
            border-radius: 13px;
          }

          .virtual-account-header {
            gap: 8px;
          }

          .virtual-account-status {
            width: 100%;
          }

          .account-number-section {
            margin-top: 16px;
          }

          .account-number {
            /*
             * Smaller but still very readable.
             */
            font-size: clamp(
              20px,
              7vw,
              25px
            );

            letter-spacing: 1px;

            /*
             * Allows long account numbers to
             * wrap instead of being cut.
             */
            overflow-wrap: anywhere;
            word-break: break-all;
          }

          .account-name {
            font-size: 13px;
          }

          .wallet-actions {
            width: 100%;
          }

          .wallet-actions .btn {
            flex: 1 1 auto;
            min-width: 120px;
            text-align: center;
          }

          .section-head {
            gap: 10px;
            flex-wrap: wrap;
          }

          .section-head > * {
            min-width: 0;
            max-width: 100%;
          }
        }

        /* =====================================================
           VERY SMALL PHONES
        ===================================================== */

        @media (max-width: 380px) {

          .dashboard-content {
            padding-left: 10px;
            padding-right: 10px;
          }

          .virtual-account-inner {
            padding: 12px;
          }

          .account-number {
            font-size: 19px;
            letter-spacing: 0.5px;
          }

          .wallet-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .wallet-actions .btn {
            width: 100%;
            min-width: 0;
          }
        }

      `}</style>
    </main>
  );
}