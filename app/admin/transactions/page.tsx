import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction, User } from "@/lib/models";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BackButton from "@/components/dashboard/BackButton";

export default async function AdminTransactionsPage() {
  const id = await currentUserId();

  if (!id) {
    redirect("/login");
  }

  await db();

  // Confirm logged-in user is an admin
  const admin: any = await User.findById(id).lean();

  if (!admin || admin.role !== "admin") {
    redirect("/dashboard");
  }

  const transactions: any[] = await Transaction.find({})
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <BackButton />

        <div className="admin-dashboard-top">
          <div className="eyebrow">ADMIN PANEL</div>

          <h1>Transactions</h1>

          <p className="muted">
            View transactions made by all customers.
          </p>
        </div>

        <div className="card">
          {transactions.length === 0 ? (
            <div>
              <h3>No transactions found</h3>

              <p className="muted">
                Customer transactions will appear here once
                they start making purchases.
              </p>
            </div>
          ) : (
            <div className="admin-transaction-list">
              {transactions.map((tx) => {
                const amount =
                  Number(tx.amountKobo || 0) / 100;

                const date = tx.createdAt
                  ? new Date(tx.createdAt).toLocaleString(
                      "en-NG",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }
                    )
                  : "-";

                return (
                  <div
                    className="admin-transaction-item"
                    key={
                      tx._id?.toString() ||
                      tx.externalReference
                    }
                  >
                    <div className="admin-transaction-main">
                      <strong>
                        {tx.service || "Transaction"}
                      </strong>

                      <span className="muted">
                        {date}
                      </span>

                      <span className="transaction-reference">
                        Ref:{" "}
                        {tx.externalReference || "-"}
                      </span>
                    </div>

                    <div>
                      <strong>
                        ₦
                        {amount.toLocaleString(
                          "en-NG",
                          {
                            minimumFractionDigits: 2,
                          }
                        )}
                      </strong>

                      <div>
                        <span
                          className={`transaction-status ${String(
                            tx.status || ""
                          ).toLowerCase()}`}
                        >
                          {tx.status || "UNKNOWN"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}