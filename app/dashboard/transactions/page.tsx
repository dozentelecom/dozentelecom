import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

import TransactionAutoRefresh from "./TransactionAutoRefresh";

export const dynamic = "force-dynamic";

function money(kobo: number) {
  return `₦${(
    Number(kobo || 0) / 100
  ).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status: string) {
  switch (
    String(status).toUpperCase()
  ) {
    case "SUCCESS":
      return "status success";

    case "FAILED":
    case "REVERSED":
      return "status failed";

    case "PROCESSING":
    case "PENDING":
      return "status pending";

    default:
      return "status";
  }
}

export default async function TransactionsPage() {
  const userId = await currentUserId();

  if (!userId) {
    redirect("/login");
  }

  await db();

  const transactions: any[] =
    await Transaction.find({
      userId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  const pendingReferences =
    transactions
      .filter((tx) =>
        ["PENDING", "PROCESSING"].includes(
          String(tx.status).toUpperCase()
        )
      )
      .map((tx) =>
        String(tx.externalReference)
      )
      .filter(Boolean);

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-content">
        <BackButton />

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
              }}
            >
              Transactions
            </h1>

            <p
              style={{
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              Your recent transactions
            </p>
          </div>

          <Link
            href="/dashboard"
            className="btn"
          >
            Dashboard
          </Link>
        </div>

        {pendingReferences.length >
          0 && (
          <TransactionAutoRefresh
            references={
              pendingReferences
            }
          />
        )}

        {!transactions.length ? (
          <div className="card">
            <p
              style={{
                margin: 0,
              }}
            >
              You have no transactions yet.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {transactions.map(
              (tx) => {
                const status =
                  String(
                    tx.status || ""
                  ).toUpperCase();

                return (
                  <Link
                    key={String(
                      tx._id
                    )}
                    href={`/dashboard/transaction/${tx._id}`}
                    className="card"
                    style={{
                      display: "block",
                      textDecoration:
                        "none",
                      color:
                        "inherit",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 15,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            textTransform:
                              "capitalize",
                          }}
                        >
                          {String(
                            tx.service ||
                              "Transaction"
                          )}
                        </strong>

                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 13,
                            opacity:
                              0.65,
                          }}
                        >
                          {tx.createdAt
                            ? new Date(
                                tx.createdAt
                              ).toLocaleString(
                                "en-NG"
                              )
                            : "—"}
                        </div>
                      </div>

                      <strong>
                        {money(
                          Number(
                            tx.amountKobo ||
                              0
                          )
                        )}
                      </strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: 12,
                        marginTop: 14,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <span
                        className={statusClass(
                          status
                        )}
                      >
                        {status ||
                          "PENDING"}
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          opacity: 0.65,
                          wordBreak:
                            "break-all",
                        }}
                      >
                        {String(
                          tx.externalReference ||
                            ""
                        )}
                      </span>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        )}
      </main>
    </div>
  );
}