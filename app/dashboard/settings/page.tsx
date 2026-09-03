import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

export default async function SettingsPage() {
  const id = await currentUserId();

  if (!id) {
    redirect("/login");
  }

  await db();

  const user: any = await User.findById(id).lean();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-main page">

        <BackButton />

        <div className="section-head">
          <div>
            <div className="eyebrow">ACCOUNT SETTINGS</div>

            <h1>Settings</h1>

            <p className="muted">
              Manage your Dozentelecom account preferences.
            </p>
          </div>
        </div>

        <div className="card">

          <h2>Account Security</h2>

          <div className="settings-list">

            <a
              href="/dashboard/reset-pin"
              className="settings-item"
            >
              <div>
                <h3>🔐 Reset Transaction PIN</h3>

                <p className="muted">
                  Change your 4-digit transaction PIN.
                </p>
              </div>

              <span>→</span>
            </a>

          </div>

        </div>

        <div className="card">

          <h2>Account Information</h2>

          <div className="settings-list">

            <a
              href="/dashboard/profile"
              className="settings-item"
            >
              <div>
                <h3>👤 Profile</h3>

                <p className="muted">
                  View your account and KYC information.
                </p>
              </div>

              <span>→</span>
            </a>

          </div>

        </div>

        <div className="card">

          <h2>Account Status</h2>

          <p>
            <b>Email:</b> {user.email}
          </p>

          <p>
            <b>KYC:</b>{" "}
            {user.kyc?.status || "PENDING"}
          </p>

          <p>
            <b>Transaction PIN:</b>{" "}
            {user.pinHash ? "Configured" : "Not configured"}
          </p>

        </div>

      </main>
    </div>
  );
}