"use client";

import { useEffect, useState } from "react";

type Bank = {
  name: string;
  code: string;
};

type ProfitData = {
  totalProfitKobo: number;
  reservedKobo: number;
  availableProfitKobo: number;
  paystackBalanceKobo: number;
  maxWithdrawableKobo: number;
};

export default function ProfitPage() {
  const [data, setData] = useState<ProfitData | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);

  const [amount, setAmount] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ---------------------------------------------------------
  // Safe JSON parser
  // Prevents "Unexpected end of JSON input"
  // ---------------------------------------------------------
  async function readResponse(response: Response) {
    const text = await response.text();

    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        error: text || "Invalid server response",
      };
    }
  }

  // ---------------------------------------------------------
  // Load profit + banks
  // ---------------------------------------------------------
  async function loadPage() {
    setLoading(true);
    setError("");

    try {
      const [profitResponse, banksResponse] = await Promise.all([
        fetch("/api/admin/profit", {
          cache: "no-store",
        }),

        fetch("/api/admin/banks", {
          cache: "no-store",
        }),
      ]);

      const profit = await readResponse(profitResponse);
      const bankData = await readResponse(banksResponse);

      if (!profitResponse.ok) {
        throw new Error(
          profit.error || "Unable to load profit information"
        );
      }

      if (!banksResponse.ok) {
        throw new Error(
          bankData.error || "Unable to load banks"
        );
      }

      setData(profit);

      setBanks(
        Array.isArray(bankData.banks)
          ? bankData.banks
          : []
      );
    } catch (e: any) {
      setError(
        e?.message ||
          "Unable to load withdrawal information"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  // ---------------------------------------------------------
  // Account verification
  // ---------------------------------------------------------
  async function verifyAccount(
    selectedBankCode = bankCode,
    selectedBankName = bankName,
    selectedAccount = accountNumber
  ) {
    if (
      selectedAccount.length !== 10 ||
      !selectedBankCode
    ) {
      setAccountName("");
      return;
    }

    setVerifying(true);
    setError("");
    setMessage("");
    setAccountName("");

    try {
      const response = await fetch(
        "/api/admin/bank/resolve",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountNumber: selectedAccount,
            bankCode: selectedBankCode,
          }),
        }
      );

      const result = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to verify this account"
        );
      }

      const resolvedName =
        result.accountName ||
        result.data?.account_name ||
        "";

      if (!resolvedName) {
        throw new Error(
          "Bank account could not be verified"
        );
      }

      setAccountName(resolvedName);
      setBankName(selectedBankName);

      setMessage(
        `Account verified successfully`
      );
    } catch (e: any) {
      setAccountName("");

      setError(
        e?.message ||
          "Unable to verify account"
      );
    } finally {
      setVerifying(false);
    }
  }

  // ---------------------------------------------------------
  // Account number change
  // ---------------------------------------------------------
  function handleAccountNumberChange(
    value: string
  ) {
    const cleaned = value
      .replace(/\D/g, "")
      .slice(0, 10);

    setAccountNumber(cleaned);
    setAccountName("");
    setError("");
    setMessage("");

    // Once 10 digits are entered and a bank
    // has already been selected, verify automatically.
    if (
      cleaned.length === 10 &&
      bankCode
    ) {
      verifyAccount(
        bankCode,
        bankName,
        cleaned
      );
    }
  }

  // ---------------------------------------------------------
  // Bank selection
  // ---------------------------------------------------------
  function handleBankChange(
    code: string
  ) {
    const selected = banks.find(
      (bank) => bank.code === code
    );

    const selectedName =
      selected?.name || "";

    setBankCode(code);
    setBankName(selectedName);
    setAccountName("");
    setError("");
    setMessage("");

    // If account number is already complete,
    // verify immediately after selecting bank.
    if (accountNumber.length === 10 && code) {
      verifyAccount(
        code,
        selectedName,
        accountNumber
      );
    }
  }

  // ---------------------------------------------------------
  // Withdraw
  // ---------------------------------------------------------
  async function withdrawProfit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setError("");
    setMessage("");

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Enter a valid withdrawal amount."
      );
      return;
    }

    if (
      !data ||
      numericAmount * 100 >
        data.maxWithdrawableKobo
    ) {
      setError(
        "Withdrawal amount exceeds your available profit."
      );
      return;
    }

    if (accountNumber.length !== 10) {
      setError(
        "Enter a valid 10-digit account number."
      );
      return;
    }

    if (!bankCode) {
      setError(
        "Please select the recipient bank."
      );
      return;
    }

    if (!accountName) {
      setError(
        "Please verify the bank account before withdrawing."
      );
      return;
    }

    setWithdrawing(true);

    try {
      const response = await fetch(
        "/api/admin/profit/withdraw",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: numericAmount,
            accountNumber,
            bankCode,
            bankName,
            accountName,
          }),
        }
      );

      const result = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            "Withdrawal failed"
        );
      }

      setMessage(
        result.message ||
          "Profit withdrawal submitted successfully."
      );

      setAmount("");

      // Refresh available profit
      // after successful withdrawal.
      await loadPage();
    } catch (e: any) {
      setError(
        e?.message ||
          "Unable to process withdrawal."
      );
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <p>Loading profit dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>
              DOZENTELECOM • ADMIN
            </div>

            <h1 style={styles.title}>
              Profit & Withdraw
            </h1>

            <p style={styles.subtitle}>
              View your business profit and securely
              withdraw available earnings.
            </p>
          </div>

          <a
            href="/admin"
            style={styles.backButton}
          >
            ← Admin Panel
          </a>
        </div>

        {/* PROFIT CARDS */}
        <div style={styles.statsGrid}>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              Total Profit
            </div>

            <div style={styles.statValue}>
              ₦
              {(
                (data?.totalProfitKobo || 0) /
                100
              ).toLocaleString()}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              Reserved
            </div>

            <div style={styles.statValue}>
              ₦
              {(
                (data?.reservedKobo || 0) /
                100
              ).toLocaleString()}
            </div>
          </div>

          <div
            style={{
              ...styles.statCard,
              ...styles.availableCard,
            }}
          >
            <div style={styles.statLabel}>
              Available Profit
            </div>

            <div style={styles.availableValue}>
              ₦
              {(
                (data?.availableProfitKobo || 0) /
                100
              ).toLocaleString()}
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>
              Paystack Balance
            </div>

            <div style={styles.statValue}>
              ₦
              {(
                (data?.paystackBalanceKobo || 0) /
                100
              ).toLocaleString()}
            </div>
          </div>

        </div>

        {/* WITHDRAWAL */}
        <div style={styles.withdrawCard}>

          <div style={styles.withdrawHeader}>
            <div>
              <h2 style={styles.withdrawTitle}>
                Withdraw Profit
              </h2>

              <p style={styles.withdrawSubtitle}>
                Send your available profit directly
                to a Nigerian bank account.
              </p>
            </div>

            <div style={styles.secureBadge}>
              🔒 Secure
            </div>
          </div>

          {error && (
            <div style={styles.error}>
              ⚠️ {error}
            </div>
          )}

          {message && (
            <div style={styles.success}>
              ✓ {message}
            </div>
          )}

          <form
            onSubmit={withdrawProfit}
            style={styles.form}
          >

            {/* AMOUNT */}
            <div style={styles.field}>
              <label style={styles.label}>
                Withdrawal amount
              </label>

              <div style={styles.inputWrapper}>
                <span style={styles.currency}>
                  ₦
                </span>

                <input
                  type="number"
                  min="100"
                  step="1"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value)
                  }
                  placeholder="Enter amount"
                  style={styles.inputWithCurrency}
                />
              </div>

              <span style={styles.help}>
                Available: ₦
                {(
                  (data?.maxWithdrawableKobo || 0) /
                  100
                ).toLocaleString()}
              </span>
            </div>

            {/* ACCOUNT NUMBER */}
            <div style={styles.field}>
              <label style={styles.label}>
                Account number
              </label>

              <input
                value={accountNumber}
                onChange={(e) =>
                  handleAccountNumberChange(
                    e.target.value
                  )
                }
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter 10-digit account number"
                style={styles.input}
              />
            </div>

            {/* BANK */}
            {accountNumber.length >= 1 && (
              <div style={styles.field}>
                <label style={styles.label}>
                  Select bank
                </label>

                <select
                  value={bankCode}
                  onChange={(e) =>
                    handleBankChange(
                      e.target.value
                    )
                  }
                  style={styles.input}
                >
                  <option value="">
                    Select recipient bank
                  </option>

                  {banks.map((bank) => (
                    <option
                      key={bank.code}
                      value={bank.code}
                    >
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* VERIFYING */}
            {verifying && (
              <div style={styles.verifying}>
                <div style={styles.smallSpinner} />
                Verifying bank account...
              </div>
            )}

            {/* ACCOUNT NAME */}
            {accountName && (
              <div style={styles.verifiedBox}>
                <div style={styles.verifiedIcon}>
                  ✓
                </div>

                <div>
                  <div style={styles.verifiedLabel}>
                    Verified account
                  </div>

                  <div style={styles.accountName}>
                    {accountName}
                  </div>

                  <div style={styles.bankText}>
                    {bankName} • {accountNumber}
                  </div>
                </div>
              </div>
            )}

            {/* WITHDRAW BUTTON */}
            <button
              type="submit"
              disabled={
                withdrawing ||
                verifying ||
                !accountName
              }
              style={{
                ...styles.withdrawButton,
                opacity:
                  withdrawing ||
                  verifying ||
                  !accountName
                    ? 0.6
                    : 1,
                cursor:
                  withdrawing ||
                  verifying ||
                  !accountName
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {withdrawing
                ? "Processing withdrawal..."
                : "Withdraw Profit"}
            </button>

          </form>
        </div>

        <div style={styles.notice}>
          <strong>Important:</strong> The account name
          must be successfully verified before a withdrawal
          can be submitted.
        </div>

      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "40px 20px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    color: "#10243e",
  },

  container: {
    width: "100%",
    maxWidth: 1050,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 30,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.2,
    color: "#6b7c93",
    marginBottom: 8,
  },

  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -0.8,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 0,
    color: "#718096",
    fontSize: 15,
  },

  backButton: {
    textDecoration: "none",
    background: "#fff",
    color: "#17324d",
    border: "1px solid #dce4ee",
    padding: "11px 16px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },

  statCard: {
    background: "#fff",
    border: "1px solid #e4eaf1",
    borderRadius: 16,
    padding: 22,
    boxShadow:
      "0 5px 20px rgba(16,36,62,0.05)",
  },

  availableCard: {
    borderColor: "#b9e4d0",
    background: "#f7fffb",
  },

  statLabel: {
    color: "#718096",
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
  },

  statValue: {
    fontSize: 25,
    fontWeight: 800,
    color: "#10243e",
  },

  availableValue: {
    fontSize: 25,
    fontWeight: 800,
    color: "#168653",
  },

  withdrawCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 28,
    boxShadow:
      "0 8px 30px rgba(16,36,62,0.07)",
    maxWidth: 700,
  },

  withdrawHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 15,
    alignItems: "flex-start",
    marginBottom: 25,
  },

  withdrawTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },

  withdrawSubtitle: {
    margin: "7px 0 0",
    color: "#718096",
    fontSize: 14,
  },

  secureBadge: {
    background: "#eef8f3",
    color: "#168653",
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: 19,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },

  label: {
    fontSize: 13,
    fontWeight: 750,
    color: "#334155",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 48,
    border: "1px solid #d5dee9",
    borderRadius: 10,
    padding: "0 14px",
    fontSize: 15,
    color: "#10243e",
    background: "#fff",
    outline: "none",
  },

  inputWrapper: {
    position: "relative",
  },

  currency: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    fontWeight: 800,
    color: "#64748b",
  },

  inputWithCurrency: {
    width: "100%",
    boxSizing: "border-box",
    height: 48,
    border: "1px solid #d5dee9",
    borderRadius: 10,
    padding: "0 14px 0 34px",
    fontSize: 15,
    color: "#10243e",
    background: "#fff",
    outline: "none",
  },

  help: {
    color: "#718096",
    fontSize: 12,
  },

  verifying: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "12px 14px",
    borderRadius: 10,
    background: "#f4f8fc",
    color: "#51657b",
    fontSize: 13,
    fontWeight: 650,
  },

  verifiedBox: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: 15,
    borderRadius: 12,
    border: "1px solid #bce4ce",
    background: "#f3fcf7",
  },

  verifiedIcon: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#168653",
    color: "#fff",
    fontWeight: 900,
  },

  verifiedLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#168653",
    fontWeight: 800,
  },

  accountName: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 800,
    color: "#10243e",
  },

  bankText: {
    marginTop: 3,
    fontSize: 12,
    color: "#718096",
  },

  withdrawButton: {
    border: 0,
    height: 50,
    borderRadius: 10,
    background: "#102f4d",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    marginTop: 5,
  },

  error: {
    background: "#fff2f2",
    border: "1px solid #ffd1d1",
    color: "#b42318",
    padding: 13,
    borderRadius: 10,
    marginBottom: 18,
    fontSize: 14,
  },

  success: {
    background: "#effbf4",
    border: "1px solid #c7ead5",
    color: "#168653",
    padding: 13,
    borderRadius: 10,
    marginBottom: 18,
    fontSize: 14,
  },

  notice: {
    marginTop: 18,
    color: "#718096",
    fontSize: 12,
    maxWidth: 700,
  },

  loadingCard: {
    background: "#fff",
    maxWidth: 400,
    margin: "100px auto",
    padding: 35,
    borderRadius: 16,
    textAlign: "center",
    boxShadow:
      "0 8px 30px rgba(16,36,62,0.07)",
  },

  spinner: {
    width: 30,
    height: 30,
    border: "3px solid #dce5ee",
    borderTopColor: "#102f4d",
    borderRadius: "50%",
    margin: "0 auto 15px",
  },

  smallSpinner: {
    width: 16,
    height: 16,
    border: "2px solid #dce5ee",
    borderTopColor: "#102f4d",
    borderRadius: "50%",
  },
};