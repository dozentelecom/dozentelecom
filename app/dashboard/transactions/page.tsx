import Link from "next/link";
import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  Transaction,
  Funding,
  Withdrawal,
} from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

export const dynamic = "force-dynamic";

type HistoryItem = {
  id: string;
  type: "service" | "funding" | "withdrawal";
  title: string;
  status: string;
  amountKobo: number;
  createdAt: Date | string | null;
  reference: string;
  href: string;
};

function money(kobo: number) {
  return `₦${(Number(kobo || 0) / 100).toLocaleString(
    "en-NG",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function statusClass(status: string) {
  switch (String(status).toUpperCase()) {
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

function normalizeStatus(status: unknown) {
  return String(status || "PENDING").toUpperCase();
}

function serviceTitle(service: unknown) {
  const value = String(service || "Transaction");

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function TransactionsPage() {
  const userId = await currentUserId();

  if (!userId) {
    redirect("/login");
  }

  await db();

  /*
   * =========================================================
   * LOAD SERVICE TRANSACTIONS
   * =========================================================
   */

  const serviceTransactions: any[] =
    await Transaction.find({
      userId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  /*
   * =========================================================
   * LOAD FUNDING RECORDS
   * =========================================================
   */

  const fundingRecords: any[] =
    await Funding.find({
      userId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  /*
   * =========================================================
   * LOAD WITHDRAWAL RECORDS
   * =========================================================
   */

  const withdrawalRecords: any[] =
    await Withdrawal.find({
      userId,
    })
      .sort({
        createdAt: -1,
      })
      .lean();

  /*
   * =========================================================
   * NORMALIZE EVERYTHING INTO ONE HISTORY
   * =========================================================
   */

  const history: HistoryItem[] = [];

  for (const tx of serviceTransactions) {
    const id = String(tx._id);

    history.push({
      id,
      type: "service",
      title: serviceTitle(tx.service),
      status: normalizeStatus(tx.status),
      amountKobo: Number(tx.amountKobo || 0),
      createdAt: tx.createdAt || null,
      reference: String(tx.externalReference || ""),
      href: `/dashboard/transactions/${id}`,
    });
  }

  for (const funding of fundingRecords) {
    const id = String(funding._id);

    const reference = String(
      funding.reference ||
        funding.externalReference ||
        funding.paystackReference ||
        funding.paymentReference ||
        ""
    );

    history.push({
      id,
      type: "funding",
      title: "Wallet Funding",
      status: normalizeStatus(funding.status),
      amountKobo: Number(
        funding.amountKobo ||
          funding.amount ||
          0
      ),
      createdAt: funding.createdAt || null,
      reference,
      href: `/dashboard/transactions/${id}?type=funding`,
    });
  }

  for (const withdrawal of withdrawalRecords) {
    const id = String(withdrawal._id);

    history.push({
      id,
      type: "withdrawal",
      title: "Withdrawal",
      status: normalizeStatus(withdrawal.status),
      amountKobo: Number(
        withdrawal.amountKobo || 0
      ),
      createdAt: withdrawal.createdAt || null,
      reference: String(
        withdrawal.reference ||
          withdrawal.externalReference ||
          ""
      ),
      href: `/dashboard/transactions/${id}?type=withdrawal`,
    });
  }

  /*
   * =========================================================
   * SORT ALL TRANSACTIONS TOGETHER
   * =========================================================
   */

  history.sort((a, b) => {
    const aTime = a.createdAt
      ? new Date(a.createdAt).getTime()
      : 0;

    const bTime = b.createdAt
      ? new Date(b.createdAt).getTime()
      : 0;

    return bTime - aTime;
  });

  /*
   * =========================================================
   * ONLY SERVICE TRANSACTIONS NEED SME STATUS POLLING
   * =========================================================
   */

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-content">
        <BackButton />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>
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

        {!history.length ? (
          <div className="card">
            <p style={{ margin: 0 }}>
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
            {history.map((item) => {
              const status = normalizeStatus(
                item.status
              );

              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.href}
                  className="card"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "flex-start",
                      gap: 15,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      <strong
                        style={{
                          textTransform:
                            "capitalize",
                        }}
                      >
                        {item.title}
                      </strong>

                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 13,
                          opacity: 0.65,
                        }}
                      >
                        {item.createdAt
                          ? new Date(
                              item.createdAt
                            ).toLocaleString(
                              "en-NG"
                            )
                          : "—"}
                      </div>
                    </div>

                    <strong
                      style={{
                        whiteSpace: "nowrap",
                      }}
                    >
                      {money(item.amountKobo)}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginTop: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className={statusClass(status)}
                    >
                      {status}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        opacity: 0.65,
                        wordBreak: "break-all",
                      }}
                    >
                      {item.reference || "—"}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 12,
                      opacity: 0.55,
                    }}
                  >
                    Tap to view detailed receipt →
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}