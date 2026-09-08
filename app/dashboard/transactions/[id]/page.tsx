import { notFound, redirect } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";
import PrintReceiptButton from "@/components/dashboard/PrintReceiptButton";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type TransactionResult = {
  _id: unknown;
  service?: string;
  status?: string;
  providerTransactionId?: string;
  externalReference?: string;
  amountKobo?: number;
  costKobo?: number;
  profitKobo?: number;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export default async function TransactionDetailsPage({
  params,
}: PageProps) {
  const userId = await currentUserId();

  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;

  await db();

  const transaction = (await Transaction.findOne({
    _id: id,
    userId,
  }).lean()) as TransactionResult | null;

  if (!transaction) {
    notFound();
  }

  /*
   * IMPORTANT:
   * amountKobo is the amount charged to the customer.
   *
   * Do NOT show:
   * - costKobo
   * - profitKobo
   * - provider cost
   * - internal pricing data
   */

  const amount = Number(transaction.amountKobo || 0) / 100;

  const date = transaction.createdAt
    ? new Date(transaction.createdAt).toLocaleString("en-NG", {
        dateStyle: "full",
        timeStyle: "short",
      })
    : "-";

  const status = String(
    transaction.status || "UNKNOWN"
  ).toUpperCase();

  const statusClass = String(
    transaction.status || "unknown"
  ).toLowerCase();

  /*
   * Only expose safe customer-facing information
   * from metadata.
   */
  const metadata =
    transaction.metadata &&
    typeof transaction.metadata === "object"
      ? transaction.metadata
      : null;

  const customerInfo: Array<{
    label: string;
    value: string;
  }> = [];

  if (metadata) {
    if (metadata.network) {
      customerInfo.push({
        label: "Network",
        value: String(metadata.network),
      });
    }

    if (metadata.phone) {
      customerInfo.push({
        label: "Phone",
        value: String(metadata.phone),
      });
    }

    if (metadata.data_plan) {
      customerInfo.push({
        label: "Plan",
        value: String(metadata.data_plan),
      });
    }

    if (metadata.provider) {
      customerInfo.push({
        label: "Provider",
        value: String(metadata.provider),
      });
    }

    if (metadata.providerCode) {
      customerInfo.push({
        label: "Provider",
        value: String(metadata.providerCode),
      });
    }

    if (metadata.meterNumber) {
      customerInfo.push({
        label: "Meter Number",
        value: String(metadata.meterNumber),
      });
    }

    if (metadata.meterType) {
      customerInfo.push({
        label: "Meter Type",
        value: String(metadata.meterType),
      });
    }

    if (metadata.iucnumber) {
      customerInfo.push({
        label: "IUC Number",
        value: String(metadata.iucnumber),
      });
    }

    if (metadata.quantity) {
      customerInfo.push({
        label: "Quantity",
        value: String(metadata.quantity),
      });
    }

    if (metadata.examProvider) {
      customerInfo.push({
        label: "Exam Provider",
        value: String(metadata.examProvider),
      });
    }

    if (metadata.examPackage) {
      customerInfo.push({
        label: "Exam Package",
        value: String(metadata.examPackage),
      });
    }
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-content">
        <BackButton />

        <div className="dashboard-top">
          <div className="eyebrow">TRANSACTION</div>

          <h1>Transaction Details</h1>

          <p className="muted">
            View the details of this transaction.
          </p>
        </div>

        <div
          className="card"
          style={{
            maxWidth: 700,
          }}
        >
          {/* SERVICE */}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="muted">
                Service
              </div>

              <h2
                style={{
                  marginTop: 5,
                }}
              >
                {transaction.service || "Transaction"}
              </h2>
            </div>

            <span
              className={`transaction-status ${statusClass}`}
              style={{
                fontSize: 14,
                padding: "7px 12px",
                borderRadius: 8,
              }}
            >
              {status}
            </span>
          </div>

          {/* CUSTOMER AMOUNT */}

          <div
            style={{
              marginTop: 28,
              padding: 18,
              borderRadius: 10,
              background: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <div
              className="muted"
              style={{
                fontSize: 13,
              }}
            >
              Amount Paid
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              ₦
              {amount.toLocaleString("en-NG", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {/* DETAILS */}

          <div
            style={{
              marginTop: 28,
              display: "grid",
              gap: 18,
            }}
          >
            <Detail
              label="Date"
              value={date}
            />

            {transaction.externalReference && (
              <Detail
                label="Reference"
                value={String(
                  transaction.externalReference
                )}
              />
            )}

            {transaction.providerTransactionId && (
              <Detail
                label="Provider Transaction ID"
                value={String(
                  transaction.providerTransactionId
                )}
              />
            )}

            <Detail
              label="Amount Paid"
              value={`₦${amount.toLocaleString(
                "en-NG",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}`}
            />
          </div>

          {/* CUSTOMER TRANSACTION INFORMATION */}

          {customerInfo.length > 0 && (
            <div
              style={{
                marginTop: 28,
              }}
            >
              <div
                className="muted"
                style={{
                  marginBottom: 10,
                }}
              >
                Transaction Information
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 0,
                  border: "1px solid rgba(148, 163, 184, 0.15)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {customerInfo.map((item, index) => (
                  <Detail
                    key={`${item.label}-${index}`}
                    label={item.label}
                    value={item.value}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ACTIONS */}

          <div
            style={{
              marginTop: 30,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <a
              href="/dashboard/transaction"
              className="btn"
            >
              ← Transactions
            </a>

            <PrintReceiptButton />
          </div>
        </div>
      </main>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 20,
        padding: "14px 16px",
        borderBottom:
          "1px solid rgba(148, 163, 184, 0.15)",
      }}
    >
      <span
        className="muted"
        style={{
          fontSize: 13,
        }}
      >
        {label}
      </span>

      <strong
        style={{
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value}
      </strong>
    </div>
  );
}