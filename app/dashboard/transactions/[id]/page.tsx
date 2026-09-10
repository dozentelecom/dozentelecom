import { redirect } from "next/navigation";
import { Types } from "mongoose";
import type { ReactNode } from "react";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction } from "@/lib/models";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";
import PrintReceiptButton from "@/components/dashboard/PrintReceiptButton";

export const dynamic = "force-dynamic";

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
  metadata?: Record<string, any> | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function formatMoney(kobo: unknown) {
  const amount = Number(kobo || 0) / 100;

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: unknown) {
  if (!value) return "—";

  return new Date(value as string | number | Date).toLocaleString(
    "en-NG",
    {
      dateStyle: "full",
      timeStyle: "medium",
    }
  );
}

function getStatusClass(status: string) {
  const s = status.toLowerCase();

  if (
    s === "success" ||
    s === "successful" ||
    s === "completed" ||
    s === "complete"
  ) {
    return "success";
  }

  if (
    s === "failed" ||
    s === "failure" ||
    s === "reversed" ||
    s === "cancelled"
  ) {
    return "failed";
  }

  return "pending";
}

function CustomerRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return (
    <div className="receipt-row">
      <span className="receipt-label">
        {label}
      </span>

      <strong className="receipt-value">
        {String(value)}
      </strong>
    </div>
  );
}

export default async function TransactionDetailsPage({
  params,
}: PageProps) {
  const userId = await currentUserId();

  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;

  await db();

  /*
   * =========================================================
   * FIND TRANSACTION
   * =========================================================
   *
   * Supports both:
   *
   * /dashboard/transactions/MONGO_ID
   *
   * and:
   *
   * /dashboard/transactions/DATA-REFERENCE
   */

  let transaction: TransactionResult | null = null;

  if (Types.ObjectId.isValid(id)) {
    transaction = (await Transaction.findOne({
      _id: id,
      userId,
    }).lean()) as TransactionResult | null;
  }

  if (!transaction) {
    transaction = (await Transaction.findOne({
      externalReference: id,
      userId,
    }).lean()) as TransactionResult | null;
  }

  if (!transaction) {
    return (
      <div className="dashboard-layout">
        <DashboardSidebar />

        <main className="dashboard-main">
          <BackButton />

          <div className="receipt-card">
            <h1>Transaction not found</h1>

            <p className="muted">
              We could not find this transaction.
            </p>

            <p className="reference-debug">
              Reference / ID: {id}
            </p>
          </div>
        </main>
      </div>
    );
  }

  /*
   * =========================================================
   * BASIC TRANSACTION INFORMATION
   * =========================================================
   */

  const service = String(
    transaction.service || "TRANSACTION"
  ).toUpperCase();

  const status = String(
    transaction.status || "UNKNOWN"
  ).toUpperCase();

  const metadata =
    transaction.metadata &&
    typeof transaction.metadata === "object"
      ? transaction.metadata
      : {};

  /*
   * =========================================================
   * PROVIDER REFERENCE
   * =========================================================
   */

  const providerReference =
    transaction.providerTransactionId ||
    metadata?.providerReference ||
    metadata?.provider_reference ||
    metadata?.provider_transaction_id ||
    metadata?.providerTransactionId ||
    metadata?.providerResponse?.reference ||
    metadata?.providerResponse?.transaction_reference ||
    metadata?.providerResponse?.transaction_id ||
    metadata?.providerResponse?.transactionId ||
    metadata?.providerResponse?.id ||
    metadata?.providerResponse?.data?.reference ||
    metadata?.providerResponse?.data?.transaction_reference ||
    metadata?.providerResponse?.data?.transaction_id ||
    metadata?.providerResponse?.data?.transactionId ||
    metadata?.providerResponse?.data?.id ||
    "—";

  /*
   * =========================================================
   * PROVIDER MESSAGE
   * =========================================================
   */

  const providerMessage =
    metadata?.providerMessage ||
    metadata?.provider_message ||
    metadata?.message ||
    metadata?.providerResponse?.message ||
    metadata?.providerResponse?.provider_message ||
    metadata?.providerResponse?.data?.message ||
    metadata?.providerResponse?.data?.provider_message ||
    metadata?.providerError?.message ||
    metadata?.providerError ||
    null;

  /*
   * =========================================================
   * DATA DETAILS
   * =========================================================
   */

  const network =
    metadata?.network ??
    metadata?.network_name ??
    metadata?.networkName;

  const dataPlan =
    metadata?.data_plan ??
    metadata?.dataPlan ??
    metadata?.planName ??
    metadata?.plan_name ??
    metadata?.plan?.name ??
    metadata?.plan?.plan_name;

  const serviceType =
    metadata?.serviceType ??
    metadata?.service_type ??
    metadata?.type ??
    metadata?.plan?.type;

  /*
   * =========================================================
   * AIRTIME DETAILS
   * =========================================================
   */

  const airtimeAmount =
    metadata?.amount ??
    metadata?.airtimeAmount ??
    metadata?.airtime_amount;

  /*
   * =========================================================
   * ELECTRICITY DETAILS
   * =========================================================
   */

  const meterNumber =
    metadata?.meterNumber ??
    metadata?.meter_number;

  const meterType =
    metadata?.meterType ??
    metadata?.meter_type;

  const providerCode =
    metadata?.providerCode ??
    metadata?.provider_code;

  /*
   * =========================================================
   * CABLE DETAILS
   * =========================================================
   */

  const packageCode =
    metadata?.packageCode ??
    metadata?.package_code;

  const decoderNumber =
    metadata?.decoderNumber ??
    metadata?.decoder_number ??
    metadata?.iucnumber ??
    metadata?.iuc_number ??
    metadata?.smartcardNumber ??
    metadata?.smartcard_number;

  const subscriptionType =
    metadata?.subscriptionType ??
    metadata?.subscription_type;

  const packageName =
    metadata?.package?.name ??
    metadata?.packageName ??
    metadata?.package_name ??
    packageCode;

  /*
   * =========================================================
   * EDUCATION DETAILS
   * =========================================================
   */

  const recipient =
    metadata?.recipient ??
    metadata?.phone ??
    metadata?.email;

  const quantity =
    metadata?.quantity;

  /*
   * =========================================================
   * COMMON CUSTOMER PHONE
   * =========================================================
   */

  const phone =
    metadata?.phone ??
    metadata?.recipientPhone ??
    metadata?.recipient_phone ??
    metadata?.senderPhone ??
    metadata?.sender_phone;

  /*
   * =========================================================
   * POSSIBLE TOKEN / PIN DETAILS
   * =========================================================
   *
   * Useful for electricity, education and other
   * services where the provider may return a token.
   */

  const token =
    metadata?.token ??
    metadata?.electricityToken ??
    metadata?.electricity_token ??
    metadata?.pin ??
    metadata?.voucher ??
    metadata?.voucherCode ??
    metadata?.voucher_code;

  /*
   * =========================================================
   * PROVIDER RESPONSE
   * =========================================================
   *
   * We don't expose internal cost/profit information.
   */

  const providerResponse =
    metadata?.providerResponse ??
    metadata?.provider_response ??
    null;

  /*
   * =========================================================
   * RENDER
   * =========================================================
   */

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      <main className="dashboard-main">
        <div className="receipt-topbar">
          <BackButton />

          <PrintReceiptButton />
        </div>

        {/*
         * IMPORTANT:
         * Everything inside this element becomes the
         * customer-shareable receipt image/PDF.
         */}
        <section
          id="receipt-content"
          className="receipt-card"
        >
          {/* =================================================
              RECEIPT HEADER
              ================================================= */}

          <div className="receipt-header">
            <div>
              <div className="eyebrow">
                DOZENTELECOM
              </div>

              <h1>
                Transaction Receipt
              </h1>

              <p className="receipt-service">
                {service}
              </p>
            </div>

            <div
              className={`receipt-status ${getStatusClass(
                status
              )}`}
            >
              {status}
            </div>
          </div>

          {/* =================================================
              MAIN TRANSACTION DETAILS
              ================================================= */}

          <div className="receipt-section">
            <h2>
              Transaction Details
            </h2>

            <CustomerRow
              label="Service"
              value={service}
            />

            <CustomerRow
              label="Amount"
              value={formatMoney(
                transaction.amountKobo
              )}
            />

            <div id="receipt-reference">
              <CustomerRow
                label="Reference"
                value={
                  transaction.externalReference ||
                  "—"
                }
              />
            </div>

            <CustomerRow
              label="Provider Reference"
              value={providerReference}
            />

            <CustomerRow
              label="Status"
              value={status}
            />

            <CustomerRow
              label="Date"
              value={formatDate(
                transaction.createdAt
              )}
            />
          </div>

          {/* =================================================
              CUSTOMER / SERVICE INFORMATION
              ================================================= */}

          <div className="receipt-section">
            <h2>
              Service Information
            </h2>

            <CustomerRow
              label="Phone"
              value={phone}
            />

            <CustomerRow
              label="Network"
              value={network}
            />

            {/* ================= DATA ================= */}

            {service === "DATA" && (
              <>
                <CustomerRow
                  label="Data Plan"
                  value={dataPlan}
                />

                <CustomerRow
                  label="Plan Type"
                  value={serviceType}
                />
              </>
            )}

            {/* ================= AIRTIME ================= */}

            {service === "AIRTIME" && (
              <CustomerRow
                label="Airtime Amount"
                value={
                  airtimeAmount !== undefined
                    ? `₦${Number(
                        airtimeAmount
                      ).toLocaleString(
                        "en-NG",
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}`
                    : undefined
                }
              />
            )}

            {/* ================= ELECTRICITY ================= */}

            {service === "ELECTRICITY" && (
              <>
                <CustomerRow
                  label="Provider"
                  value={providerCode}
                />

                <CustomerRow
                  label="Meter Number"
                  value={meterNumber}
                />

                <CustomerRow
                  label="Meter Type"
                  value={meterType}
                />

                <CustomerRow
                  label="Token"
                  value={token}
                />
              </>
            )}

            {/* ================= CABLE ================= */}

            {service === "CABLE" && (
              <>
                <CustomerRow
                  label="Provider"
                  value={providerCode}
                />

                <CustomerRow
                  label="Decoder / IUC Number"
                  value={decoderNumber}
                />

                <CustomerRow
                  label="Package"
                  value={packageName}
                />

                <CustomerRow
                  label="Subscription Type"
                  value={subscriptionType}
                />
              </>
            )}

            {/* ================= EDUCATION ================= */}

            {service === "EDUCATION" && (
              <>
                <CustomerRow
                  label="Provider"
                  value={providerCode}
                />

                <CustomerRow
                  label="Package"
                  value={packageName}
                />

                <CustomerRow
                  label="Recipient"
                  value={recipient}
                />

                <CustomerRow
                  label="Quantity"
                  value={quantity}
                />

                <CustomerRow
                  label="PIN / Voucher"
                  value={token}
                />
              </>
            )}
          </div>

          {/* =================================================
              PROVIDER MESSAGE
              ================================================= */}

          {providerMessage && (
            <div className="provider-message">
              <h2>
                Provider Message
              </h2>

              <p>
                {typeof providerMessage ===
                "string"
                  ? providerMessage
                  : JSON.stringify(
                      providerMessage
                    )}
              </p>
            </div>
          )}

          {/* =================================================
              PROVIDER RESPONSE DETAILS
              =================================================
              
              Only show useful customer-facing
              information if available.
              Do NOT expose provider cost/profit.
              ================================================= */}

          {providerResponse &&
            typeof providerResponse ===
              "object" && (
              <div className="receipt-section provider-details">
                <h2>
                  Transaction Information
                </h2>

                <CustomerRow
                  label="Token"
                  value={
                    providerResponse?.token ??
                    providerResponse?.data
                      ?.token ??
                    providerResponse
                      ?.electricity_token ??
                    providerResponse
                      ?.data
                      ?.electricity_token
                  }
                />

                <CustomerRow
                  label="Units"
                  value={
                    providerResponse?.units ??
                    providerResponse?.data
                      ?.units
                  }
                />

                <CustomerRow
                  label="Customer Name"
                  value={
                    providerResponse
                      ?.customer_name ??
                    providerResponse
                      ?.customerName ??
                    providerResponse?.data
                      ?.customer_name ??
                    providerResponse?.data
                      ?.customerName
                  }
                />
              </div>
            )}

          {/* =================================================
              RECEIPT FOOTER
              ================================================= */}

          <div className="receipt-footer">
            <strong>
              Dozentelecom
            </strong>

            <br />

            This receipt shows customer
            transaction information.
          </div>
        </section>
      </main>

      <style>{`
        .dashboard-layout {
          min-height: 100vh;
          display: flex;
          background: #f5f7fa;
        }

        .dashboard-main {
          flex: 1;
          min-width: 0;
          padding: 24px;
        }

        .receipt-topbar {
          max-width: 850px;
          margin: 0 auto 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .receipt-card {
          width: 100%;
          max-width: 850px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 18px;
          padding: 28px;
          box-shadow:
            0 8px 30px rgba(15, 23, 42, 0.08);
        }

        .receipt-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 22px;
          border-bottom: 1px solid #e5e7eb;
        }

        .eyebrow {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #64748b;
          margin-bottom: 7px;
        }

        .receipt-header h1 {
          margin: 0;
          font-size: 28px;
          color: #102a43;
        }

        .receipt-service {
          margin: 6px 0 0;
          color: #64748b;
          font-weight: 700;
        }

        .receipt-status {
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .receipt-status.success {
          background: #dcfce7;
          color: #166534;
        }

        .receipt-status.failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .receipt-status.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .receipt-section {
          margin-top: 25px;
        }

        .receipt-section h2,
        .provider-message h2 {
          margin: 0 0 4px;
          font-size: 16px;
          color: #102a43;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          padding: 14px 0;
          border-bottom: 1px solid #edf0f3;
        }

        .receipt-label {
          color: #64748b;
          font-size: 14px;
          flex: 0 0 40%;
        }

        .receipt-value {
          color: #102a43;
          font-size: 14px;
          text-align: right;
          word-break: break-word;
          max-width: 60%;
        }

        .provider-message {
          margin-top: 25px;
          padding: 16px;
          border-radius: 12px;
          background: #f8fafc;
        }

        .provider-message p {
          margin: 8px 0 0;
          color: #475569;
          line-height: 1.5;
          word-break: break-word;
        }

        .provider-details {
          margin-top: 25px;
        }

        .receipt-footer {
          margin-top: 25px;
          padding-top: 18px;
          border-top: 1px solid #e5e7eb;
          color: #64748b;
          font-size: 13px;
          text-align: center;
          line-height: 1.6;
        }

        .reference-debug {
          margin-top: 15px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 8px;
          word-break: break-all;
          font-size: 13px;
        }

        .muted {
          color: #64748b;
        }

        @media (max-width: 700px) {
          .dashboard-main {
            padding: 14px 10px;
          }

          .receipt-card {
            padding: 18px 14px;
            border-radius: 14px;
          }

          .receipt-header {
            flex-direction: column;
          }

          .receipt-header h1 {
            font-size: 23px;
          }

          .receipt-status {
            align-self: flex-start;
          }

          .receipt-row {
            gap: 12px;
          }

          .receipt-label {
            flex-basis: 42%;
          }

          .receipt-value {
            max-width: 58%;
          }
        }

        @media print {
          .receipt-topbar,
          aside,
          nav {
            display: none !important;
          }

          .dashboard-layout {
            background: #ffffff;
          }

          .dashboard-main {
            padding: 0;
          }

          .receipt-card {
            box-shadow: none;
            max-width: none;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}