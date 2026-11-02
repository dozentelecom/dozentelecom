
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import FlutterwaveAccountCard from "@/components/dashboard/FlutterwaveAccountCard";
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
    .sort({ balanceKobo: -1 })
    .lean();

  return (
    <main className="dashboard-layout">
      <DashboardSidebar />

      <section className="dashboard-content">
        {/* TOP BAR */}
        <div className="dashboard-top">
          <div>
            <p className="muted">Welcome back</p>
            <h1>Dashboard</h1>
          </div>
          <NotificationBell />
        </div>

        {/* WALLET AND FLUTTERWAVE ACCOUNT SIDE BY SIDE */}
        <section className="dashboard-summary-grid">

          {/* WALLET BOX - ORIGINAL CONTENT PRESERVED */}
          <div className="card wallet-card">
            <div className="muted">Wallet balance</div>

            <h2 className="wallet-balance">
              ₦
              {((w?.balanceKobo || 0) / 100).toLocaleString(
                undefined,
                { minimumFractionDigits: 2 }
              )}
            </h2>

            <div className="wallet-actions">
              <Link className="btn primary" href="/dashboard/fund">
                Fund wallet
              </Link>
            </div>
          </div>

          {/* FLUTTERWAVE ACCOUNT BOX */}
          <FlutterwaveAccountCard
            initialAccountNumber={u?.kyc?.flutterwaveAccountNumber || ""}
            initialBankName={u?.kyc?.flutterwaveBankName || ""}
            initialAccountName={u?.kyc?.flutterwaveAccountName || ""}
            initialStatus={u?.kyc?.flutterwaveDvaStatus || ""}
            name={u?.name || ""}
          />

        </section>

        {/* SERVICES */}
        <div className="section-head">
          <div>
            <h2>Services</h2>
          </div>
        </div>

        <div className="service-card-grid">
          {[
            ["Data", "📶"],
            ["Giveaway", "🎁"],
          ].map(([x, icon]) => (
            <Link
              href={
                x === "Giveaway"
                  ? "/dashboard/giveaway"
                  : "/dashboard/services"
              }
              className="card service-card"
              key={x}
            >
              <div className="service-icon">{icon}</div>
              <h3>{x}</h3>
              <p className="muted">
                {x === "Giveaway"
                  ? "Send Airtime or Data as a gift"
                  : "Open secure form"}
              </p>
            </Link>
          ))}
        </div>

        {/* CONTACT AND COMMUNITY */}
        <div className="section-head">
          <div>
            <h2>Contact & Community</h2>
            <p className="muted">
              Need help? Contact our support team or join our
              WhatsApp community.
            </p>
          </div>
        </div>

        <div className="contact-grid">
          <a
            href="https://wa.me/2348143140831"
            target="_blank"
            rel="noopener noreferrer"
            className="card service-card"
          >
            <div className="service-icon">💬</div>
            <h3>Chat with Admin</h3>
            <p className="muted">
              Message us directly on WhatsApp
            </p>
          </a>

          <a
            href="https://chat.whatsapp.com/Euf9WLOfblGD1BzH4c4jVE"
            target="_blank"
            rel="noopener noreferrer"
            className="card service-card"
          >
            <div className="service-icon">👥</div>
            <h3>Join WhatsApp Group</h3>
            <p className="muted">
              Join our community for updates and announcements
            </p>
          </a>

          <a
            href="mailto:ajibadeayodeji07@gmail.com"
            className="card service-card"
          >
            <div className="service-icon">✉️</div>
            <h3>Email Support</h3>
            <p className="muted">
              Contact our support team by email
            </p>
          </a>
        </div>
      </section>

      {/* RESPONSIVE DASHBOARD STYLES */}
      <style>{`
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

        /* WALLET AND FLUTTERWAVE BOXES */
        .dashboard-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          margin-bottom: 24px;
          align-items: stretch;
          box-sizing: border-box;
        }

        .dashboard-summary-grid > * {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
        }

        .wallet-card,
        .virtual-account-card {
          min-width: 0;
          max-width: 100%;
          overflow: hidden;
          box-sizing: border-box;
        }

        .wallet-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .wallet-balance {
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        /* KEEP ORIGINAL FUND WALLET BUTTON STYLING */
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

        /* FLUTTERWAVE ACCOUNT CONTENT */
        .virtual-account-inner {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          padding: clamp(12px, 2vw, 20px);
          border-radius: 16px;
          color: #ffffff;
          overflow: hidden;
        }

        .virtual-account-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
          min-width: 0;
        }

        .virtual-account-bank {
          min-width: 0;
          max-width: 100%;
          flex: 1 1 120px;
        }

        .virtual-account-label {
          font-size: 12px;
          color: #cbd5e1;
          margin-bottom: 5px;
        }

        .virtual-account-bank-name {
          font-size: clamp(14px, 1.5vw, 17px);
          font-weight: 700;
          color: #ffffff;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .virtual-account-status {
          flex: 0 1 auto;
          max-width: 100%;
          font-size: 11px;
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

        .account-number-section {
          width: 100%;
          min-width: 0;
          margin-top: 18px;
          box-sizing: border-box;
        }

        .account-number-label {
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .account-number {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          font-size: clamp(18px, 2.3vw, 27px);
          line-height: 1.3;
          font-weight: 800;
          letter-spacing: 1px;
          color: #ffffff;
          overflow-wrap: anywhere;
          word-break: break-all;
          white-space: normal;
          box-sizing: border-box;
        }

        .account-name-section {
          width: 100%;
          min-width: 0;
          margin-top: 14px;
          box-sizing: border-box;
        }

        .account-name-label {
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .account-name {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 600;
          color: #e2e8f0;
          text-transform: uppercase;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: normal;
        }

        .account-empty-state {
          margin-top: 16px;
          overflow-wrap: anywhere;
        }

        /* TABLET */
        @media (max-width: 900px) {
          .dashboard-content {
            width: 100%;
            max-width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .dashboard-summary-grid {
            gap: 12px;
          }

          .virtual-account-inner {
            padding: 14px;
          }

          .account-number {
            font-size: clamp(17px, 2.5vw, 23px);
          }
        }

        /* MOBILE */
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
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .virtual-account-inner {
            padding: 16px;
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
            font-size: clamp(20px, 6vw, 25px);
            letter-spacing: 1px;
          }

          .account-name {
            font-size: 13px;
          }

          /* ORIGINAL WALLET BUTTON RESPONSIVE STYLING */
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

        /* VERY SMALL PHONES */
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
