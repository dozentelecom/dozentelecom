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

  const balance =
    Number(wallet?.balanceKobo || 0) / 100;

  return (
    <main className="dashboard-content">

      <div className="dashboard-top">

        <Link
          href="/admin/customers"
          className="btn"
        >
          ← Customers
        </Link>

        <div className="eyebrow">
          CUSTOMER
        </div>

        <h1>{user.name}</h1>

        <p className="muted">
          {user.email}
        </p>

      </div>

      {/* Customer information */}

      <div className="grid">

        <div className="card">
          <h3>Customer Information</h3>

          <p>
            <strong>Name:</strong>{" "}
            {user.name}
          </p>

          <p>
            <strong>Email:</strong>{" "}
            {user.email}
          </p>

          <p>
            <strong>Phone:</strong>{" "}
            {user.phone ||
              user.phoneNumber ||
              "—"}
          </p>

          <p>
            <strong>KYC:</strong>{" "}
            {user.kyc?.status ||
              "PENDING"}
          </p>
        </div>

        <div className="card">
          <h3>Wallet</h3>

          <h2>
            ₦
            {balance.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
              }
            )}
          </h2>
        </div>

        <div className="card">
          <h3>Dedicated Account</h3>

          {user.kyc?.accountNumber ? (
            <>
              <p>
                <strong>Bank:</strong>{" "}
                {user.kyc.bankName ||
                  "—"}
              </p>

              <h2>
                {user.kyc.accountNumber}
              </h2>

              <p>
                {user.kyc.accountName}
              </p>

              <p className="muted">
                DVA:{" "}
                {user.kyc.dvaStatus ||
                  "—"}
              </p>
            </>
          ) : (
            <p className="muted">
              No dedicated account assigned.
            </p>
          )}
        </div>

      </div>

      {/* VTU Transactions */}

      <div className="card">

        <h2>Transaction History</h2>

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
                      {tx.createdAt
                        ? new Date(
                            tx.createdAt
                          ).toLocaleString()
                        : "—"}
                    </td>

                    <td>
                      {tx.service ||
                        "—"}
                    </td>

                    <td>
                      {tx.externalReference ||
                        "—"}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          tx.amountKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          tx.costKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          tx.profitKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      {tx.status ||
                        "—"}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

          {transactions.length === 0 && (
            <p className="muted">
              This customer has not made
              any VTU transactions yet.
            </p>
          )}

        </div>

      </div>

      {/* Funding History */}

      <div className="card">

        <h2>Funding History</h2>

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
                      {item.createdAt
                        ? new Date(
                            item.createdAt
                          ).toLocaleString()
                        : "—"}
                    </td>

                    <td>
                      {item.reference ||
                        "—"}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          item.grossKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          item.feeKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      ₦
                      {(
                        Number(
                          item.creditKobo ||
                            0
                        ) / 100
                      ).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      {item.status ||
                        "—"}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

          {funding.length === 0 && (
            <p className="muted">
              No wallet funding records.
            </p>
          )}

        </div>

      </div>

    </main>
  );
}