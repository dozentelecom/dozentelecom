"use client";

import { useState } from "react";

type CustomerEmailsClientProps = {
  emails: string[];
  verifiedEmails: string[];
  unverifiedEmails: string[];
  apiEmails: string[];
};

export default function CustomerEmailsClient({
  emails,
  verifiedEmails,
  unverifiedEmails,
  apiEmails,
}: CustomerEmailsClientProps) {
  const [copiedGroup, setCopiedGroup] = useState<string | null>(null);

  function getEmailText(list: string[]) {
    return list.join(", ");
  }

  async function copyEmails(
    groupName: string,
    list: string[]
  ) {
    if (!list.length) return;

    try {
      await navigator.clipboard.writeText(
        getEmailText(list)
      );

      setCopiedGroup(groupName);

      setTimeout(() => {
        setCopiedGroup(null);
      }, 2500);
    } catch (error) {
      console.error("COPY EMAILS ERROR:", error);

      alert(
        "Unable to copy emails. Please try again."
      );
    }
  }

  const groups = [
    {
      key: "all",
      title: "All Customers",
      description:
        "All unique registered customer email addresses.",
      emails,
    },
    {
      key: "verified",
      title: "Verified Customers",
      description:
        "Customers who have completed KYC verification.",
      emails: verifiedEmails,
    },
    {
      key: "unverified",
      title: "Not Verified Customers",
      description:
        "Customers who have not completed KYC verification.",
      emails: unverifiedEmails,
    },
    {
      key: "api",
      title: "API Customers",
      description:
        "Customers registered for API access.",
      emails: apiEmails,
    },
  ];

  return (
    <>
      {/* SUMMARY */}
      <div className="admin-analytics-grid">
        {groups.map((group) => (
          <div
            className="admin-stat-card"
            key={group.key}
          >
            <span>{group.title}</span>

            <strong>
              {group.emails.length.toLocaleString()}
            </strong>

            <small>{group.description}</small>
          </div>
        ))}
      </div>

      {/* EMAIL RECIPIENT GROUPS */}
      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <div
          style={{
            marginBottom: "20px",
          }}
        >
          <h2>Email Recipients</h2>

          <p className="muted">
            Select the customer group you want to
            email, then copy the addresses directly
            into the BCC field of your email.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "14px",
          }}
        >
          {groups.map((group) => (
            <div
              key={group.key}
              style={{
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "8px",
                }}
              >
                <strong>{group.title}</strong>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {group.emails.length.toLocaleString()}
                </span>
              </div>

              <p
                className="muted"
                style={{
                  fontSize: "13px",
                  marginBottom: "14px",
                }}
              >
                {group.description}
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  copyEmails(
                    group.key,
                    group.emails
                  )
                }
                disabled={!group.emails.length}
                style={{
                  width: "100%",
                }}
              >
                {copiedGroup === group.key
                  ? "✓ Emails Copied"
                  : "📋 Copy Emails"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ALL EMAILS */}
      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "18px",
          }}
        >
          <div>
            <h2>Customer Email List</h2>

            <p className="muted">
              All customer email addresses are shown
              below. You can copy them and paste them
              into BCC.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() =>
              copyEmails("all", emails)
            }
            disabled={!emails.length}
          >
            {copiedGroup === "all"
              ? "✓ Emails Copied"
              : "📋 Copy All Emails"}
          </button>
        </div>

        {emails.length > 0 ? (
          <textarea
            readOnly
            value={getEmailText(emails)}
            rows={10}
            onFocus={(event) =>
              event.currentTarget.select()
            }
            style={{
              width: "100%",
              resize: "vertical",
              padding: "14px",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              fontSize: "14px",
              lineHeight: "1.6",
              background: "#f9fafb",
              color: "#111827",
            }}
          />
        ) : (
          <p className="muted">
            No customer email addresses found.
          </p>
        )}

        <p
          className="muted"
          style={{
            marginTop: "12px",
            fontSize: "13px",
          }}
        >
          Emails are automatically deduplicated
          before copying.
        </p>
      </div>
    </>
  );
    }
