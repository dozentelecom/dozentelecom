"use client";

import { useEffect, useState } from "react";

type Bank = {
  id: number;
  name: string;
  code: string;
};

type Beneficiary = {
  id: string;
  name: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  lastVerifiedAt?: string;
  createdAt?: string;
};

export default function WithdrawalPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<
    Beneficiary[]
  >([]);

  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [pin, setPin] = useState("");

  const [payout, setPayout] = useState(0);
  const [withdrawalRate, setWithdrawalRate] = useState(0);

  const [loadingBanks, setLoadingBanks] = useState(true);
  const [loadingBeneficiaries, setLoadingBeneficiaries] =
    useState(true);

  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingBeneficiary, setSavingBeneficiary] =
    useState(false);
  const [deletingBeneficiary, setDeletingBeneficiary] =
    useState("");

  const [verified, setVerified] = useState(false);

  const [selectedBeneficiary, setSelectedBeneficiary] =
    useState("");

  const [saveBeneficiary, setSaveBeneficiary] =
    useState(false);

  const [beneficiaryName, setBeneficiaryName] =
    useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* =========================================================
     LOAD BANKS
     ========================================================= */

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

    loadBanks();
  }, []);

  /* =========================================================
     LOAD BENEFICIARIES
     ========================================================= */

  async function loadBeneficiaries() {
    try {
      const response = await fetch(
        "/api/beneficiaries",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load saved beneficiaries."
        );
      }

      setBeneficiaries(
        Array.isArray(data?.beneficiaries)
          ? data.beneficiaries
          : []
      );
    } catch (err: any) {
      console.error(
        "LOAD BENEFICIARIES ERROR:",
        err
      );
    } finally {
      setLoadingBeneficiaries(false);
    }
  }

  useEffect(() => {
    loadBeneficiaries();
  }, []);

  /* =========================================================
     LOAD WITHDRAWAL RATE
     ========================================================= */

  useEffect(() => {
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

    loadRates();
  }, []);

  /* =========================================================
     CALCULATE PAYOUT
     ========================================================= */

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

  /* =========================================================
     RESET VERIFICATION
     ========================================================= */

  function resetVerification() {
    setVerified(false);
    setAccountName("");
    setError("");
    setMessage("");
  }

  /* =========================================================
     SELECT BENEFICIARY
     ========================================================= */

  function selectBeneficiary(id: string) {
    setError("");
    setMessage("");

    setSelectedBeneficiary(id);

    if (!id) {
      setBankCode("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");
      setVerified(false);
      setBeneficiaryName("");
      return;
    }

    const beneficiary =
      beneficiaries.find(
        (item) => item.id === id
      );

    if (!beneficiary) return;

    setBankCode(beneficiary.bankCode);
    setBankName(beneficiary.bankName);
    setAccountNumber(
      beneficiary.accountNumber
    );
    setAccountName(
      beneficiary.accountName
    );
    setBeneficiaryName(
      beneficiary.name
    );

    /*
     * We intentionally do NOT mark the account
     * permanently verified just because it was saved.
     *
     * The account will still be verified by the
     * server before the withdrawal is paid.
     */
    setVerified(true);
  }

  /* =========================================================
     MANUAL BANK CHANGE
     ========================================================= */

  function handleBankChange(code: string) {
    const bank = banks.find(
      (item) => item.code === code
    );

    setSelectedBeneficiary("");

    setBankCode(code);
    setBankName(bank?.name || "");

    setAccountNumber("");
    setAccountName("");
    setBeneficiaryName("");

    setVerified(false);
    setError("");
    setMessage("");
  }

  /* =========================================================
     ACCOUNT NUMBER CHANGE
     ========================================================= */

  function handleAccountNumberChange(
    value: string
  ) {
    const cleaned = value.replace(/\D/g, "");

    setSelectedBeneficiary("");
    setAccountNumber(cleaned);

    setVerified(false);
    setAccountName("");
    setError("");
    setMessage("");
  }

  /* =========================================================
     VERIFY ACCOUNT
     ========================================================= */

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

  /* =========================================================
     SAVE BENEFICIARY
     ========================================================= */

  async function saveCurrentBeneficiary() {
    setError("");
    setMessage("");

    if (!beneficiaryName.trim()) {
      setError(
        "Enter a name for this beneficiary."
      );
      return;
    }

    if (!bankCode || !bankName) {
      setError("Please select your bank.");
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      setError(
        "Enter a valid 10-digit account number."
      );
      return;
    }

    if (!accountName || !verified) {
      setError(
        "Please verify the account first."
      );
      return;
    }

    setSavingBeneficiary(true);

    try {
      const response = await fetch(
        "/api/beneficiaries",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: beneficiaryName.trim(),
            bankCode,
            bankName,
            accountNumber,
            accountName,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to save beneficiary."
        );
      }

      setMessage(
        "Beneficiary saved successfully."
      );

      setSaveBeneficiary(false);

      await loadBeneficiaries();

      if (data?.beneficiary?.id) {
        setSelectedBeneficiary(
          String(data.beneficiary.id)
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save beneficiary."
      );
    } finally {
      setSavingBeneficiary(false);
    }
  }

  /* =========================================================
     DELETE BENEFICIARY
     ========================================================= */

  async function deleteBeneficiary(
    id: string
  ) {
    const confirmed = window.confirm(
      "Remove this saved bank account?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setDeletingBeneficiary(id);

    try {
      const response = await fetch(
        `/api/beneficiaries/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to remove beneficiary."
        );
      }

      setBeneficiaries((current) =>
        current.filter(
          (item) => item.id !== id
        )
      );

      if (selectedBeneficiary === id) {
        setSelectedBeneficiary("");
        setBankCode("");
        setBankName("");
        setAccountNumber("");
        setAccountName("");
        setBeneficiaryName("");
        setVerified(false);
      }

      setMessage(
        "Beneficiary removed successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to remove beneficiary."
      );
    } finally {
      setDeletingBeneficiary("");
    }
  }

  /* =========================================================
     SUBMIT WITHDRAWAL
     ========================================================= */

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

    if (
      !/^\d{10}$/.test(accountNumber)
    ) {
      setError(
        "Enter a valid 10-digit account number."
      );
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
      setBeneficiaryName("");
      setSelectedBeneficiary("");
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

        {/* =================================================
            MESSAGES
        ================================================= */}

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
          {/* =================================================
              AMOUNT
          ================================================= */}

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
                {payout.toLocaleString(
                  "en-NG",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </strong>
            </div>
          )}

          {/* =================================================
              SAVED BENEFICIARY
          ================================================= */}

          <label
            style={{
              display: "block",
              marginTop: 22,
              marginBottom: 8,
            }}
          >
            Saved bank account
          </label>

          <select
            className="input"
            value={selectedBeneficiary}
            disabled={
              loadingBeneficiaries
            }
            onChange={(e) =>
              selectBeneficiary(
                e.target.value
              )
            }
          >
            <option value="">
              {loadingBeneficiaries
                ? "Loading saved accounts..."
                : beneficiaries.length
                ? "Select a saved account"
                : "No saved accounts"}
            </option>

            {beneficiaries.map(
              (beneficiary) => (
                <option
                  key={beneficiary.id}
                  value={beneficiary.id}
                >
                  {beneficiary.name} —{" "}
                  {beneficiary.bankName} —{" "}
                  {beneficiary.accountNumber}
                </option>
              )
            )}
          </select>

          {/* =================================================
              SAVED BENEFICIARY LIST
          ================================================= */}

          {beneficiaries.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 8,
              }}
            >
              {beneficiaries.map(
                (beneficiary) => (
                  <div
                    key={beneficiary.id}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border:
                        "1px solid #334155",
                      background:
                        "#0f172a",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            display:
                              "block",
                            color:
                              "#ffffff",
                          }}
                        >
                          {beneficiary.name}
                        </strong>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color:
                              "#cbd5e1",
                          }}
                        >
                          {
                            beneficiary.accountName
                          }
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 12,
                            color:
                              "#94a3b8",
                          }}
                        >
                          {
                            beneficiary.bankName
                          }{" "}
                          •{" "}
                          {
                            beneficiary.accountNumber
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          deleteBeneficiary(
                            beneficiary.id
                          )
                        }
                        disabled={
                          deletingBeneficiary ===
                          beneficiary.id
                        }
                        style={{
                          fontSize: 12,
                          padding:
                            "7px 10px",
                        }}
                      >
                        {deletingBeneficiary ===
                        beneficiary.id
                          ? "Removing..."
                          : "Remove"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* =================================================
              BANK
          ================================================= */}

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
            onChange={(e) =>
              handleBankChange(
                e.target.value
              )
            }
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

          {/* =================================================
              ACCOUNT NUMBER
          ================================================= */}

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
            onChange={(e) =>
              handleAccountNumberChange(
                e.target.value
              )
            }
            placeholder="10-digit account number"
            required
          />

          {/* =================================================
              VERIFY
          ================================================= */}

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

          {/* =================================================
              VERIFIED ACCOUNT
          ================================================= */}

          {verified && accountName && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 8,
                background: "#0f172a",
                border:
                  "1px solid #334155",
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
                {bankName} •{" "}
                {accountNumber}
              </div>
            </div>
          )}

          {/* =================================================
              SAVE AS BENEFICIARY
          ================================================= */}

          {verified &&
            accountName &&
            !selectedBeneficiary && (
              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 8,
                  border:
                    "1px solid #334155",
                  background:
                    "#020617",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 8,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      saveBeneficiary
                    }
                    onChange={(e) => {
                      setSaveBeneficiary(
                        e.target.checked
                      );

                      if (
                        e.target.checked &&
                        !beneficiaryName
                      ) {
                        setBeneficiaryName(
                          accountName
                        );
                      }
                    }}
                  />

                  <span>
                    Save this account for
                    future withdrawals
                  </span>
                </label>

                {saveBeneficiary && (
                  <div
                    style={{
                      marginTop: 12,
                    }}
                  >
                    <input
                      className="input"
                      type="text"
                      maxLength={50}
                      value={
                        beneficiaryName
                      }
                      onChange={(e) =>
                        setBeneficiaryName(
                          e.target.value
                        )
                      }
                      placeholder="Beneficiary name e.g. My GTBank"
                    />

                    <button
                      type="button"
                      className="btn"
                      onClick={
                        saveCurrentBeneficiary
                      }
                      disabled={
                        savingBeneficiary
                      }
                      style={{
                        marginTop: 10,
                      }}
                    >
                      {savingBeneficiary
                        ? "Saving..."
                        : "Save beneficiary"}
                    </button>
                  </div>
                )}
              </div>
            )}

          {/* =================================================
              PIN
          ================================================= */}

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

          {/* =================================================
              WITHDRAW
          ================================================= */}

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