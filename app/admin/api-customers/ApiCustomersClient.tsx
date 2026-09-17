"use client";

import { useState } from "react";

type Customer = {
  id: string;
  name: string;
  email: string;
  companyName: string;
  status: string;
  balanceKobo: number;
  testApiKeyPrefix: string;
  liveApiKeyPrefix: string;
  services: Record<string, boolean>;
  createdAt: string | null;
};

export default function ApiCustomersClient({
  customers,
}: {
  customers: Customer[];
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [loading, setLoading] = useState(false);

  const [generatedKeys, setGeneratedKeys] = useState<{
    test: string;
    live: string;
  } | null>(null);

  async function createCustomer() {
    if (!name.trim() || !email.trim()) {
      alert("Name and email are required.");
      return;
    }

    setLoading(true);
    setGeneratedKeys(null);

    try {
      const response = await fetch(
        "/api/admin/api-customers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            companyName,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(
          json.message ||
            "Unable to create API customer."
        );
      }

      setGeneratedKeys(json.apiKeys);

      setName("");
      setEmail("");
      setCompanyName("");

      alert(
        "API customer created. Save both API keys now."
      );

      window.location.reload();
    } catch (error) {
      console.error(
        "CREATE API CUSTOMER ERROR:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to create API customer."
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      alert("API key copied.");
    } catch {
      alert("Unable to copy API key.");
    }
  }

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: "24px",
        }}
      >
        <h2>Create API Customer</h2>

        <p className="muted">
          Generate separate Test and Live API keys.
        </p>

        <div
          style={{
            display: "grid",
            gap: "14px",
            marginTop: "18px",
          }}
        >
          <input
            type="text"
            placeholder="Customer name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />

          <input
            type="email"
            placeholder="Customer email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Company / Website name (optional)"
            value={companyName}
            onChange={(e) =>
              setCompanyName(e.target.value)
            }
          />

          <button
            type="button"
            className="primary-button"
            onClick={createCustomer}
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Generate API Keys"}
          </button>
        </div>
      </div>

      {generatedKeys && (
        <div
          className="card"
          style={{
            marginBottom: "24px",
          }}
        >
          <h2>API Keys Generated</h2>

          <p className="muted">
            Save these keys now. The complete keys will
            not be stored in the database.
          </p>

          <div style={{ marginTop: "18px" }}>
            <strong>TEST API KEY</strong>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <input
                readOnly
                value={generatedKeys.test}
                style={{
                  flex: 1,
                }}
              />

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  copyKey(generatedKeys.test)
                }
              >
                Copy
              </button>
            </div>
          </div>

          <div style={{ marginTop: "18px" }}>
            <strong>LIVE API KEY</strong>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "8px",
              }}
            >
              <input
                readOnly
                value={generatedKeys.live}
                style={{
                  flex: 1,
                }}
              />

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  copyKey(generatedKeys.live)
                }
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>API Customers</h2>

        {customers.length === 0 ? (
          <p className="muted">
            No API customers have been created yet.
          </p>
        ) : (
          <div
            style={{
              overflowX: "auto",
              marginTop: "18px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Test Key</th>
                  <th>Live Key</th>
                </tr>
              </thead>

              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>

                    <td>{customer.email}</td>

                    <td>
                      {customer.companyName || "—"}
                    </td>

                    <td>{customer.status}</td>

                    <td>
                      ₦
                      {(
                        customer.balanceKobo / 100
                      ).toLocaleString()}
                    </td>

                    <td>
                      {customer.testApiKeyPrefix
                        ? `${customer.testApiKeyPrefix}...`
                        : "—"}
                    </td>

                    <td>
                      {customer.liveApiKeyPrefix
                        ? `${customer.liveApiKeyPrefix}...`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
