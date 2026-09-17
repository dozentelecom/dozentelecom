"use client";

import { useState } from "react";

type Props = {
  emails: string[];
};

export default function CustomerEmailsClient({
  emails,
}: Props) {
  const [copied, setCopied] =
    useState(false);

  const emailText = emails.join(", ");

  async function copyEmails() {
    if (!emailText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        emailText
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch (error) {
      console.error(
        "COPY EMAILS ERROR:",
        error
      );

      alert(
        "Unable to copy emails. Please try again."
      );
    }
  }

  return (
    <>
      <div className="admin-analytics-grid">
        <div className="admin-stat-card">
          <span>
            Total Customer Emails
          </span>

          <strong>
            {emails.length.toLocaleString()}
          </strong>

          <small>
            Unique registered email addresses
          </small>
        </div>
      </div>

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
            <h2>
              Customer Email List
            </h2>

            <p className="muted">
              Copy all customer emails for
              general communication.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={copyEmails}
            disabled={emails.length === 0}
          >
            {copied
              ? "✓ Emails Copied"
              : "📋 Copy All Emails"}
          </button>
        </div>

        {emails.length > 0 ? (
          <textarea
            readOnly
            value={emailText}
            rows={10}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            style={{
              width: "100%",
              resize: "vertical",
              padding: "14px",
              borderRadius: "10px",
              border:
                "1px solid #d1d5db",
              fontSize: "14px",
              lineHeight: "1.6",
              background: "#f9fafb",
              color: "#111827",
              boxSizing: "border-box",
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
          Duplicate email addresses are
          automatically removed.
        </p>
      </div>
    </>
  );
}
