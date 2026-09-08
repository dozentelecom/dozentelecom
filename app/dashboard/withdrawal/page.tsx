"use client";

import { useEffect, useState } from "react";

type Bank = {
  id: number;
  name: string;
  code: string;
};

export default function WithdrawalPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pin, setPin] = useState("");

  const [payout, setPayout] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(0);

  const [loadingBanks, setLoadingBanks] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBanks() {
      try {
        const response = await fetch(
          "/api/withdrawal/banks",
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load banks."
          );
        }

        setBanks(data.banks || []);
      } catch (err: any) {
        setError(
          err?.message || "Unable to load banks."
        );
      } finally {
        setLoadingBanks(false);
      }
    }

    async function loadRates() {
      try {
        const response = await fetch(
          "/api/settings/rates",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        const rate = Number(
          data?.rates?.withdrawal ??
            data?.withdrawal ??
            0
        );

        if (Number.isFinite(rate)) {
          setWithdrawalRate(rate);
        }
      } catch {
        // Keep default rate at 0.
      }
    }

    loadBanks();
    loadRates();
  }, []);

  useEffect(() => {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      setPayout(0);
      return;
    }

    const calculatedFee =
      Math.ceil(
        value * (withdrawalRate / 100) * 100
      ) / 100;

    setPayout(
      Math.max(0, value - calculatedFee)
    );
  }, [amount, withdrawalRate]);

  function resetVerification() {
    setVerified(false);
    setAccountName("");
    setError("");
    setMessage("");
  }

  async function verifyAccount() {
    setError("");
    setMessage("");
    setVerified(false);

    if (!bankCode) {
      setError("Please select your bank.");
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      setError(
        "Enter a valid 10-digit account number."
      );
      return;
    }

    setVerifying(true);

    try {
      const response = await fetch(
        "/api/withdrawal/verify-account",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountNumber,
            bankCode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to verify this account."
        );
      }

      setAccountName(
        data.accountName || ""
      );

      setVerified(true);

      setMessage(
        "Bank account verified successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to verify this bank account."
      );
    } finally {
      setVerifying(false);
    }
  }

  async function submitWithdrawal(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 100
    ) {
      setError(
        "Minimum withdrawal amount is ₦100."
      );
      return;
    }

    if (!bankCode || !bankName) {
      setError("Please select your bank.");
      return;
    }

    if (!verified || !accountName) {
      setError(
        "Please verify your bank account first."
      );
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(
        "Enter your 4-digit transaction PIN."
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        "/api/withdrawal/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: numericAmount,
            bankCode,
            bankName,
            accountNumber,
            accountName,
            pin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to process withdrawal."
        );
      }

      setMessage(
        data?.message ||
          "Withdrawal submitted successfully."
      );

      setAmount("");
      setPin("");
      setAccountName("");
      setVerified(false);
      setPayout(0);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to process withdrawal."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="shell page">
      <div
        className="card"
        style={{
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <h1>Withdraw from wallet</h1>

        <p className="muted">
          Withdraw your wallet balance directly
          to your Nigerian bank account.
        </p>

        {error && (
          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 8,
              background: "#fee2e2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 8,
              background: "#dcfce7",
              color: "#166534",
            }}
          >
            {message}
          </div>
        )}

        <form
          onSubmit={submitWithdrawal}
          style={{ marginTop: 24 }}
        >
          <label
            style={{
              display: "block",
              marginBottom: 8,
            }}
          >
            Withdrawal amount
          </label>

          <input
            className="input"
            type="number"
            min="100"
            step="0.01"
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value)
            }
            placeholder="Amount"
            required
          />

          {Number(amount) > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "#94a3b8",
              }}
            >
              Amount to be received:{" "}
              <strong
                style={{
                  color: "#e2e8f0",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                ₦
                {payout.toLocaleString("en-NG", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>
          )}

          <label
            style={{
              display: "block",
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Bank
          </label>

          <select
            className="input"
            value={bankCode}
            disabled={loadingBanks}
            onChange={(e) => {
              const code = e.target.value;

              const bank = banks.find(
                (item) => item.code === code
              );

              setBankCode(code);
              setBankName(
                bank?.name || ""
              );

              resetVerification();
            }}
            required
          >
            <option value="">
              {loadingBanks
                ? "Loading banks..."
                : "Select bank"}
            </option>

            {banks.map((bank) => (
              <option
                key={`${bank.code}-${bank.id}`}
                value={bank.code}
              >
                {bank.name}
              </option>
            ))}
          </select>

          <label
            style={{
              display: "block",
              marginTop: 18,
              marginBottom: 8,
            }}
          >
            Account number
          </label>

          <input
            className="input"
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => {
              const value =
                e.target.value.replace(
                  /\D/g,
                  ""
                );

              setAccountNumber(value);
              resetVerification();
            }}
            placeholder="10-digit account number"
            required
          />

          <button
            type="button"
            className="btn"
            onClick={verifyAccount}
            disabled={
              verifying ||
              !bankCode ||
              accountNumber.length !== 10
            }
            style={{
              marginTop: 12,
            }}
          >
            {verifying
              ? "Verifying account..."
              : "Verify account"}
          </button>

          {verified && accountName && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 8,
                background: "#0f172a",
                border: "1px solid #334155",
                color: "#ffffff",
              }}
            >
              <strong
                style={{
                  display: "block",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#ffffff",
                }}
              >
                {accountName}
              </strong>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 13,
                  color: "#cbd5e1",
                }}
              >
                {bankName} • {accountNumber}
              </div>
            </div>
          )}

          <label
            style={{
              display: "block",
              marginTop: 22,
              marginBottom: 8,
            }}
          >
            Transaction PIN
          </label>

          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(
                e.target.value.replace(
                  /\D/g,
                  ""
                )
              )
            }
            placeholder="4-digit PIN"
            required
          />

          <button
            className="btn primary"
            type="submit"
            disabled={
              submitting ||
              !verified ||
              !accountName
            }
            style={{
              marginTop: 18,
              width: "100%",
            }}
          >
            {submitting
              ? "Processing withdrawal..."
              : "Withdraw money"}
          </button>
        </form>

        <div
          style={{
            marginTop: 24,
            textAlign: "center",
          }}
        >
          <a
            href="/dashboard"
            className="muted"
          >
            ← Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}