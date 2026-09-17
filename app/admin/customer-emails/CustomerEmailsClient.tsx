"use client";

import { useState } from "react";

type CustomerEmailsClientProps = {
  emails: string[];
  verifiedEmails: string[];
  unverifiedEmails: string[];
};

export default function CustomerEmailsClient({
  emails,
  verifiedEmails,
  unverifiedEmails,
}: CustomerEmailsClientProps) {
  const [copiedGroup, setCopiedGroup] =
    useState<string | null>(null);

  async function copyEmails(
    group: string,
    emailList: string[]
  ) {
    if (!emailList.length) return;

    try {
      await navigator.clipboard.writeText(
        emailList.join(", ")
      );

      setCopiedGroup(group);

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

  return (
    <>
      {/* EMAIL COUNTS */}
      <div className="admin-analytics-grid">
        <div className="admin-stat-card">
          <span>All Customers</span>

          <strong>
            {emails.length.toLocaleString()}
          </strong>

          <small>
            All unique customer email addresses
          </small>
        </div>

        <div className="admin-stat-card">
          <span>Verified Customers</span>

          <strong>
            {verifiedEmails.length.toLocaleString()}
          </strong>

          <small>
            Customers who completed KYC
          </small>
        </div>

        <div className="admin-stat-card">
          <span>Not Verified Customers</span>

          <strong>
            {unverifiedEmails.length.toLocaleString()}
          </strong>

          <small>
            Customers who have not completed KYC
          </small>
        </div>
      </div>

      {/* COPY EMAIL GROUPS */}
      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <h2>Customer Email Groups</h2>

          <p className="muted">
            Copy the email addresses for the customer
            group you want to contact and paste them
            into the BCC field of your email.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          {/* ALL */}
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3>All Customers</h3>

            <p className="muted">
              {emails.length.toLocaleString()} email
              addresses
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                copyEmails("all", emails)
              }
              disabled={!emails.length}
              style={{ width: "100%" }}
            >
              {copiedGroup === "all"
                ? "✓ Emails Copied"
                : "📋 Copy All Emails"}
            </button>
          </div>

          {/* VERIFIED */}
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3>Verified Customers</h3>

            <p className="muted">
              {verifiedEmails.length.toLocaleString()}{" "}
              email addresses
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                copyEmails(
                  "verified",
                  verifiedEmails
                )
              }
              disabled={!verifiedEmails.length}
              style={{ width: "100%" }}
            >
              {copiedGroup === "verified"
                ? "✓ Emails Copied"
                : "📋 Copy Verified Emails"}
            </button>
          </div>

          {/* NOT VERIFIED */}
          <div
            style={{
              border: "1px solid #d1d5db",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <h3>Not Verified Customers</h3>

            <p className="muted">
              {unverifiedEmails.length.toLocaleString()}{" "}
              email addresses
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                copyEmails(
                  "unverified",
                  unverifiedEmails
                )
              }
              disabled={!unverifiedEmails.length}
              style={{ width: "100%" }}
            >
              {copiedGroup === "unverified"
                ? "✓ Emails Copied"
                : "📋 Copy Unverified Emails"}
            </button>
          </div>
        </div>
      </div>

      {/* ALL EMAILS DISPLAY */}
      <div
        className="card"
        style={{
          marginTop: "24px",
        }}
      >
        <div
          style={{
            marginBottom: "18px",
          }}
        >
          <h2>Customer Email List</h2>

          <p className="muted">
            All customer email addresses.
          </p>
        </div>

        {emails.length > 0 ? (
          <textarea
            readOnly
            value={emails.join(", ")}
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
