import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

export default async function TransactionsPage() {
  const id = await currentUserId();

  if (!id) {
    redirect("/login");
  }

  await db();

  const transactions: any[] = await Transaction.find({
    userId: id,
  })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-content">
        <BackButton />

        <div className="dashboard-top">
          <div className="eyebrow">ACCOUNT</div>

          <h1>Transactions</h1>

          <p className="muted">
            View all transactions made from your account.
          </p>
        </div>

        <div className="card">
          {transactions.length === 0 ? (
            <div>
              <h3>No transactions yet</h3>

              <p className="muted">
                Your airtime, data, electricity, cable TV,
                education and other transactions will appear
                here.
              </p>
            </div>
          ) : (
            <div className="transaction-list">
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
                    className="transaction-item"
                    key={
                      tx._id?.toString() ||
                      tx.externalReference
                    }
                  >
                    <div>
                      <strong>
                        {tx.service || "Transaction"}
                      </strong>

                      <div className="muted">
                        {date}
                      </div>

                      {tx.externalReference && (
                        <div className="transaction-reference">
                          Ref: {tx.externalReference}
                        </div>
                      )}
                    </div>

                    <div className="transaction-right">
                      <strong>
                        ₦
                        {amount.toLocaleString(
                          "en-NG",
                          {
                            minimumFractionDigits: 2,
                          }
                        )}
                      </strong>

                      <span
                        className={`transaction-status ${
                          String(
                            tx.status || ""
                          ).toLowerCase()
                        }`}
                      >
                        {tx.status || "UNKNOWN"}
                      </span>
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