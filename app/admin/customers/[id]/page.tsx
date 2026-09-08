import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  User,
  Wallet,
  Transaction,
  Funding,
} from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function CustomerDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  await db();

  const { id } = await params;

  const user: any = await User.findById(id)
    .select("-passwordHash -pinHash")
    .lean();

  if (!user) {
    notFound();
  }

  const wallet: any =
    await Wallet.findOne({
      userId: user._id,
    }).lean();

  const transactions: any[] =
    await Transaction.find({
      userId: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

  const funding: any[] =
    await Funding.find({
      userId: user._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

  const balanceKobo =
    Number(wallet?.balanceKobo || 0);

  const balance =
    balanceKobo / 100;

  const vipLevel =
    user.vipLevel || "NORMAL";

  const kycStatus =
    user.kyc?.status || "PENDING";

  const totalTransactions =
    transactions.length;

  const successfulTransactions =
    transactions.filter(
      (tx) =>
        ["SUCCESS", "COMPLETED"].includes(
          String(
            tx.status || ""
          ).toUpperCase()
        )
    ).length;

  const totalProfitKobo =
    transactions.reduce(
      (sum, tx) =>
        sum +
        Number(
          tx.profitKobo || 0
        ),
      0
    );

  const totalFundingKobo =
    funding.reduce(
      (sum, item) =>
        sum +
        Number(
          item.creditKobo || 0
        ),
      0
    );

  function money(kobo: number) {
    return `₦${(
      Number(kobo || 0) / 100
    ).toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDate(
    value: any
  ) {
    if (!value) return "—";

    return new Date(
      value
    ).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatService(
    service?: string
  ) {
    if (!service) return "—";

    return service
      .replace(/[_-]/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );
  }

  function statusClass(
    status?: string
  ) {
    const normalized =
      String(
        status || ""
      ).toLowerCase();

    return `transaction-status ${normalized}`;
  }

  return (
    <div className="admin-dashboard-layout">
      <main className="admin-dashboard-content">
        {/* HEADER */}

        <div className="admin-dashboard-top">
          <Link
            href="/admin/customers"
            className="btn"
          >
            ← Customers
          </Link>

          <div
            style={{
              marginTop: 20,
            }}
          >
            <div className="eyebrow">
              CUSTOMER MANAGEMENT
            </div>

            <h1>
              {user.name ||
                "Unnamed customer"}
            </h1>

            <p className="muted">
              {user.email ||
                "No email address"}
            </p>
          </div>
        </div>

        {/* CUSTOMER OVERVIEW */}

        <div className="admin-customer-overview-grid">
          <div className="card">
            <span className="muted">
              Wallet Balance
            </span>

            <h2>
              {money(
                balanceKobo
              )}
            </h2>
          </div>

          <div className="card">
            <span className="muted">
              Membership
            </span>

            <div
              className={`admin-customer-vip ${vipLevel.toLowerCase()}`}
              style={{
                marginTop: 10,
                width: "fit-content",
              }}
            >
              {vipLevel}
            </div>
          </div>

          <div className="card">
            <span className="muted">
              KYC Status
            </span>

            <h3
              style={{
                marginTop: 8,
              }}
            >
              {kycStatus}
            </h3>
          </div>

          <div className="card">
            <span className="muted">
              Account Created
            </span>

            <p
              style={{
                marginTop: 8,
              }}
            >
              {formatDate(
                user.createdAt
              )}
            </p>
          </div>
        </div>

        {/* CUSTOMER INFORMATION */}

        <div className="admin-customer-details-grid">
          <div className="card">
            <h2>
              Customer Information
            </h2>

            <div className="admin-customer-detail-list">
              <div>
                <span className="muted">
                  Full Name
                </span>

                <strong>
                  {user.name || "—"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Email
                </span>

                <strong>
                  {user.email || "—"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Phone
                </span>

                <strong>
                  {user.phone ||
                    user.phoneNumber ||
                    "—"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Account Role
                </span>

                <strong>
                  {user.role ||
                    "customer"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  VIP Level
                </span>

                <strong>
                  {vipLevel}
                </strong>
              </div>

              <div>
                <span className="muted">
                  KYC Status
                </span>

                <strong>
                  {kycStatus}
                </strong>
              </div>
            </div>
          </div>

          {/* WALLET */}

          <div className="card">
            <h2>
              Wallet
            </h2>

            <div
              style={{
                marginTop: 15,
              }}
            >
              <span className="muted">
                Available Balance
              </span>

              <h1>
                {money(
                  balanceKobo
                )}
              </h1>

              <p className="muted">
                Currency:{" "}
                {wallet?.currency ||
                  "NGN"}
              </p>
            </div>
          </div>
        </div>

        {/* CUSTOMER STATISTICS */}

        <div className="card">
          <h2>
            Customer Statistics
          </h2>

          <div className="admin-customer-stat-grid">
            <div>
              <span className="muted">
                VTU Transactions
              </span>

              <strong>
                {totalTransactions.toLocaleString(
                  "en-NG"
                )}
              </strong>
            </div>

            <div>
              <span className="muted">
                Successful
              </span>

              <strong>
                {successfulTransactions.toLocaleString(
                  "en-NG"
                )}
              </strong>
            </div>

            <div>
              <span className="muted">
                Transaction Profit
              </span>

              <strong>
                {money(
                  totalProfitKobo
                )}
              </strong>
            </div>

            <div>
              <span className="muted">
                Total Funding
              </span>

              <strong>
                {money(
                  totalFundingKobo
                )}
              </strong>
            </div>
          </div>
        </div>

        {/* DEDICATED ACCOUNT */}

        <div className="card">
          <h2>
            Dedicated Account
          </h2>

          {user.kyc?.accountNumber ? (
            <div className="admin-customer-detail-list">
              <div>
                <span className="muted">
                  Bank
                </span>

                <strong>
                  {user.kyc.bankName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Account Number
                </span>

                <strong>
                  {user.kyc.accountNumber}
                </strong>
              </div>

              <div>
                <span className="muted">
                  Account Name
                </span>

                <strong>
                  {user.kyc.accountName ||
                    "—"}
                </strong>
              </div>

              <div>
                <span className="muted">
                  DVA Status
                </span>

                <strong>
                  {user.kyc.dvaStatus ||
                    "—"}
                </strong>
              </div>
            </div>
          ) : (
            <p className="muted">
              No dedicated account
              assigned.
            </p>
          )}
        </div>

        {/* ADMIN CONTROLS */}

        <div className="card">
          <h2>
            Account Controls
          </h2>

          <p className="muted">
            Administrative actions will
            appear here once their
            protected endpoints and
            audit logging are enabled.
          </p>

          <div className="admin-customer-control-grid">
            <button
              type="button"
              className="secondary-button"
              disabled
            >
              Change VIP Level
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled
            >
              Block Account
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled
            >
              Wallet Adjustment
            </button>
          </div>
        </div>

        {/* VTU TRANSACTIONS */}

        <div className="card">
          <h2>
            Transaction History
          </h2>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Cost</th>
                  <th>Profit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map(
                  (tx) => (
                    <tr
                      key={String(
                        tx._id
                      )}
                    >
                      <td>
                        {formatDate(
                          tx.createdAt
                        )}
                      </td>

                      <td>
                        {formatService(
                          tx.service
                        )}
                      </td>

                      <td>
                        {tx.externalReference ||
                          "—"}
                      </td>

                      <td>
                        {money(
                          Number(
                            tx.amountKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            tx.costKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            tx.profitKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            tx.status
                          )}
                        >
                          {tx.status ||
                            "UNKNOWN"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {transactions.length ===
              0 && (
              <p className="muted">
                This customer has not
                made any VTU transactions
                yet.
              </p>
            )}
          </div>
        </div>

        {/* FUNDING HISTORY */}

        <div className="card">
          <h2>
            Funding History
          </h2>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Gross</th>
                  <th>Fee</th>
                  <th>Wallet Credit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {funding.map(
                  (item) => (
                    <tr
                      key={String(
                        item._id
                      )}
                    >
                      <td>
                        {formatDate(
                          item.createdAt
                        )}
                      </td>

                      <td>
                        {item.reference ||
                          "—"}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.grossKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.feeKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.creditKobo ||
                              0
                          )
                        )}
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            item.status
                          )}
                        >
                          {item.status ||
                            "UNKNOWN"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            {funding.length ===
              0 && (
              <p className="muted">
                No wallet funding
                records.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}