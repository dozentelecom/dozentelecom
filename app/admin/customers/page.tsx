import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";

export default async function AdminCustomersPage() {
  await requireAdmin();
  await db();

  const users: any[] = await User.find({
    role: "customer",
  })
    .select(
      "name email phone phoneNumber role kyc createdAt"
    )
    .sort({ createdAt: -1 })
    .lean();

  const userIds = users.map((u) => u._id);

  const wallets: any[] = await Wallet.find({
    userId: { $in: userIds },
  }).lean();

  const walletMap = new Map(
    wallets.map((w) => [
      String(w.userId),
      w,
    ])
  );

  return (
    <main className="dashboard-content">

      <div className="dashboard-top">
        <div className="eyebrow">
          ADMINISTRATION
        </div>

        <h1>Customers</h1>

        <p className="muted">
          Manage registered Dozentelecom customers.
        </p>
      </div>

      <div className="card">

        <div className="admin-table-wrapper">

          <table className="admin-table">

            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>KYC</th>
                <th>Virtual Account</th>
                <th>Wallet</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>

            <tbody>

              {users.map((user) => {

                const wallet =
                  walletMap.get(
                    String(user._id)
                  );

                const phone =
                  user.phone ||
                  user.phoneNumber ||
                  "—";

                const balance =
                  Number(
                    wallet?.balanceKobo || 0
                  ) / 100;

                const kycStatus =
                  String(
                    user.kyc?.status ||
                    "PENDING"
                  ).toUpperCase();

                const accountNumber =
                  String(
                    user.kyc?.accountNumber ||
                    ""
                  ).trim();

                const accountName =
                  String(
                    user.kyc?.accountName ||
                    ""
                  ).trim();

                const bankName =
                  String(
                    user.kyc?.bankName ||
                    ""
                  ).trim();

                const accountMissing =
                  kycStatus === "VERIFIED" &&
                  !accountNumber;

                return (
                  <tr key={String(user._id)}>

                    <td>
                      <strong>
                        {user.name}
                      </strong>

                      <div className="muted">
                        {user.email}
                      </div>
                    </td>

                    <td>
                      {phone}
                    </td>

                    <td>
                      {kycStatus === "VERIFIED" ? (
                        <span
                          style={{
                            color: "#15803d",
                            fontWeight: 700,
                          }}
                        >
                          ✓ VERIFIED
                        </span>
                      ) : (
                        kycStatus
                      )}
                    </td>

                    <td>

                      {accountNumber ? (
                        <div>
                          <strong>
                            {accountNumber}
                          </strong>

                          {bankName && (
                            <div className="muted">
                              {bankName}
                            </div>
                          )}

                          {accountName && (
                            <div
                              className="muted"
                              style={{
                                fontSize: "12px",
                              }}
                            >
                              {accountName}
                            </div>
                          )}
                        </div>
                      ) : accountMissing ? (
                        <div>
                          <div
                            style={{
                              color: "#b45309",
                              fontWeight: 600,
                              marginBottom: "6px",
                            }}
                          >
                            ⚠ Account missing
                          </div>

                          <span className="muted">
                            DVA not saved
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}

                    </td>

                    <td>
                      ₦
                      {balance.toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                        }
                      )}
                    </td>

                    <td>
                      {user.createdAt
                        ? new Date(
                            user.createdAt
                          ).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>
                      <Link
                        className="btn"
                        href={`/admin/customers/${user._id}`}
                      >
                        View
                      </Link>
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

          {users.length === 0 && (
            <p className="muted">
              No registered customers found.
            </p>
          )}

        </div>

      </div>

    </main>
  );
}