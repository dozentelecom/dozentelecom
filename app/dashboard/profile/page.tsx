import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

export default async function ProfilePage() {
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
            <div className="eyebrow">ACCOUNT</div>
            <h1>My Profile</h1>
            <p className="muted">
              View and manage your account information.
            </p>
          </div>
        </div>

        <div className="card">
          <h2>Personal Information</h2>

          <div className="profile-info">

            <div>
              <span className="muted">Full Name</span>
              <h3>{user.name || "Not available"}</h3>
            </div>

            <div>
              <span className="muted">Email Address</span>
              <h3>{user.email || "Not available"}</h3>
            </div>

            <div>
              <span className="muted">Phone Number</span>
              <h3>
                {user.phone ||
                  user.phoneNumber ||
                  "Not available"}
              </h3>
            </div>

            <div>
              <span className="muted">Account Type</span>
              <h3>{user.role || "customer"}</h3>
            </div>

            <div>
              <span className="muted">KYC Status</span>
              <h3>{user.kyc?.status || "PENDING"}</h3>
            </div>

          </div>
        </div>

        <div className="card">
          <h2>Wallet Account</h2>

          {user.kyc?.accountNumber ? (
            <div>
              <p>
                <b>Bank:</b>{" "}
                {user.kyc.bankName || "Not available"}
              </p>

              <p>
                <b>Account Number:</b>{" "}
                {user.kyc.accountNumber}
              </p>

              <p>
                <b>Account Name:</b>{" "}
                {user.kyc.accountName || "Not available"}
              </p>
            </div>
          ) : (
            <p className="muted">
              No dedicated account number has been assigned yet.
            </p>
          )}
        </div>

      </main>
    </div>
  );
}