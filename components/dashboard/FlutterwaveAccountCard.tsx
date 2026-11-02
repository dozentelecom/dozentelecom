
"use client";

import { useState } from "react";

type Props = {
  initialAccountNumber?: string;
  initialBankName?: string;
  initialAccountName?: string;
  initialStatus?: string;
  name?: string;
  existingIdentityVerified?: boolean;
};

export default function FlutterwaveAccountCard({
  initialAccountNumber = "",
  initialBankName = "",
  initialAccountName = "",
  initialStatus = "",
  name = "",
}: Props) {
  const [nin, setNin] = useState("");
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [bankName, setBankName] = useState(
    initialBankName || "Flutterwave MFB"
  );
  const [accountName, setAccountName] = useState(initialAccountName || name);
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function createAccount() {
    setError("");
    setMessage("");

    const cleanNin = nin.replace(/\s/g, "");

    if (!/^\d{11}$/.test(cleanNin)) {
      setError("Enter your valid 11-digit NIN.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/flutterwave/dva", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nin: cleanNin }),
        cache: "no-store",
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result?.success || !result?.accountNumber) {
        throw new Error(
          result?.error || "Could not create your Flutterwave account."
        );
      }

      setAccountNumber(String(result.accountNumber));
      setBankName(String(result.bankName || "Flutterwave MFB"));
      setAccountName(String(result.accountName || name));
      setStatus(String(result.status || "ACTIVE"));
      setNin("");
      setMessage("Your Flutterwave account is ready.");
    } catch (e: any) {
      setError(
        e?.message || "Account creation failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card virtual-account-card flutterwave-card">
      <div className="virtual-account-inner">
        <div className="virtual-account-header">
          <div className="virtual-account-bank">
            <div className="virtual-account-label">
              Flutterwave Account
            </div>

            <div className="virtual-account-bank-name">
              {bankName}
            </div>
          </div>

          {status && (
            <div
              className={`virtual-account-status ${
                status === "ACTIVE" ? "active" : "pending"
              }`}
            >
              {status === "ACTIVE"
                ? "● Account Active"
                : `● ${status}`}
            </div>
          )}
        </div>

        {accountNumber ? (
          <>
            <div className="account-number-section">
              <div className="account-number-label">
                Account Number
              </div>

              <div className="account-number" title={accountNumber}>
                {accountNumber}
              </div>
            </div>

            <div className="account-name-section">
              <div className="account-name-label">
                Account Name
              </div>

              <div className="account-name">
                {accountName || name || "Dozentelecom customer"}
              </div>
            </div>
          </>
        ) : (
          <div className="flutterwave-form">
            <h3>Generate Flutterwave account</h3>

            <p className="muted">
              Enter your 11-digit NIN to generate your permanent
              Flutterwave account number.
            </p>

            <label htmlFor="flutterwave-nin">
              11-digit NIN
            </label>

            <input
              id="flutterwave-nin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={nin}
              onChange={(e) =>
                setNin(e.target.value.replace(/\D/g, "").slice(0, 11))
              }
              placeholder="Enter your NIN"
              disabled={busy}
            />

            <button
              type="button"
              className="btn primary"
              onClick={createAccount}
              disabled={busy || nin.length !== 11}
            >
              {busy ? "Creating account..." : "Create Flutterwave account"}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="flutterwave-error">
            {error}
          </p>
        )}

        {message && (
          <p role="status" className="flutterwave-success">
            {message}
          </p>
        )}
      </div>

      <style jsx>{`
        .flutterwave-card {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
          overflow: hidden;
        }

        .virtual-account-inner {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }

        .virtual-account-header,
        .virtual-account-bank {
          min-width: 0;
          max-width: 100%;
        }

        .virtual-account-bank-name,
        .account-number,
        .account-name {
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .flutterwave-form {
          width: 100%;
          min-width: 0;
          margin-top: 16px;
          box-sizing: border-box;
        }

        .flutterwave-form h3 {
          font-size: 16px;
          margin-bottom: 8px;
        }

        .flutterwave-form p {
          font-size: 13px;
          line-height: 1.5;
        }

        .flutterwave-form label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .flutterwave-form input {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          height: 44px;
          padding: 10px 12px;
          margin-bottom: 12px;
          box-sizing: border-box;
        }

        .flutterwave-form button {
          width: 100%;
          max-width: 100%;
          white-space: normal;
          box-sizing: border-box;
        }

        .flutterwave-error,
        .flutterwave-success {
          font-size: 13px;
          line-height: 1.5;
          overflow-wrap: anywhere;
          margin-top: 10px;
        }

        .flutterwave-error {
          color: #dc2626;
        }

        .flutterwave-success {
          color: #16a34a;
        }

        @media (max-width: 600px) {
          .flutterwave-form h3 {
            font-size: 15px;
          }

          .flutterwave-form button {
            font-size: 13px;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
}
