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
  existingIdentityVerified = false,
}: Props) {
  const [nin, setNin] = useState("");
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber);
  const [bankName, setBankName] = useState(initialBankName);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nin: cleanNin }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not create your account.");
      }

      setAccountNumber(String(result.accountNumber || ""));
      setBankName(String(result.bankName || ""));
      setAccountName(String(result.accountName || name));
      setStatus(String(result.status || "ACTIVE"));
      setNin("");
      setMessage("Your Flutterwave account is ready.");
    } catch (e: any) {
      setError(e?.message || "Account creation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card virtual-account-card">
      <div className="virtual-account-inner">
        <div className="virtual-account-header">
          <div className="virtual-account-bank">
            <div className="virtual-account-label">Flutterwave Account</div>
            <div className="virtual-account-bank-name">{bankName || "Flutterwave MFB"}</div>
          </div>
          {status && (
            <div className={`virtual-account-status ${status === "ACTIVE" ? "active" : "pending"}`}>
              {status === "ACTIVE" ? "● Account Active" : `● ${status}`}
            </div>
          )}
        </div>

        {accountNumber ? (
          <>
            <div className="account-number-section">
              <div className="account-number-label">Account Number</div>
              <div className="account-number" title={accountNumber}>{accountNumber}</div>
            </div>
            <div className="account-name-section">
              <div className="account-name-label">Account Name</div>
              <div className="account-name">{accountName || name || "Dozentelecom customer"}</div>
            </div>
          </>
        ) : (
          <>
            <h3>Generate account number</h3>
            <p className="muted">
              Enter your NIN to get account number.
            </p>
            <label htmlFor="flutterwave-nin" style={{ display: "block", marginBottom: 6 }}>11-digit NIN</label>
            <input
              id="flutterwave-nin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={11}
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="Enter your NIN"
              disabled={busy}
              style={{ width: "100%", marginBottom: 10 }}
            />
            <button type="button" className="btn primary" onClick={createAccount} disabled={busy || nin.length !== 11}>
              {busy ? "Creating account..." : "Create Flutterwave account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
