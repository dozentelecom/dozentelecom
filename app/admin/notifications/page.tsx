"use client";

import { FormEvent, useEffect, useState } from "react";

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
};

const TYPES = [
  "GENERAL",
  "ANNOUNCEMENT",
  "TRANSACTION",
  "FUNDING",
  "SECURITY",
  "PROMOTION",
];

export default function AdminNotificationsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recipient, setRecipient] = useState("ALL");
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState("ANNOUNCEMENT");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await fetch(
          "/api/admin/notifications/customers",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to load customers");
        }

        const data = await response.json();

        if (Array.isArray(data.customers)) {
          setCustomers(data.customers);
        }
      } catch (error) {
        console.error(
          "Failed to load notification customers:",
          error
        );
      } finally {
        setLoadingCustomers(false);
      }
    }

    loadCustomers();
  }, []);

  async function sendNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setStatus("");

    if (!title.trim()) {
      setError("Please enter a notification title.");
      return;
    }

    if (!message.trim()) {
      setError("Please enter a notification message.");
      return;
    }

    if (recipient === "CUSTOMER" && !customerId) {
      setError("Please select a customer.");
      return;
    }

    try {
      setSending(true);

      const response = await fetch(
        "/api/admin/notifications",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient,
            customerId:
              recipient === "CUSTOMER"
                ? customerId
                : undefined,
            type,
            title: title.trim(),
            message: message.trim(),
            link: link.trim(),
            expiresAt:
              expiresAt || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "Failed to send notification."
        );
        return;
      }

      setStatus(
        recipient === "ALL"
          ? "Notification sent successfully to all customers."
          : "Notification sent successfully."
      );

      setTitle("");
      setMessage("");
      setLink("");
      setExpiresAt("");
      setCustomerId("");
    } catch (error) {
      console.error(
        "SEND NOTIFICATION ERROR:",
        error
      );

      setError(
        "Unable to send notification. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="admin-notifications-page">
      <div className="admin-notifications-header">
        <div>
          <h1>Notifications</h1>

          <p>
            Send announcements and important messages
            directly to customers.
          </p>
        </div>
      </div>

      <form
        onSubmit={sendNotification}
        className="admin-notification-card"
      >
        <div className="admin-notification-section">
          <h2>Send Notification</h2>

          <p>
            Choose who should receive the notification
            and enter the message below.
          </p>
        </div>

        <div className="admin-notification-grid">
          {/* RECIPIENT */}
          <div className="admin-notification-field">
            <label htmlFor="notification-recipient">
              Recipients
            </label>

            <select
              id="notification-recipient"
              value={recipient}
              onChange={(event) => {
                setRecipient(event.target.value);
                setCustomerId("");
              }}
            >
              <option value="ALL">
                All Customers
              </option>

              <option value="CUSTOMER">
                Specific Customer
              </option>
            </select>
          </div>

          {/* CUSTOMER */}
          {recipient === "CUSTOMER" && (
            <div className="admin-notification-field">
              <label htmlFor="notification-customer">
                Select Customer
              </label>

              <select
                id="notification-customer"
                value={customerId}
                onChange={(event) =>
                  setCustomerId(event.target.value)
                }
                disabled={loadingCustomers}
              >
                <option value="">
                  {loadingCustomers
                    ? "Loading customers..."
                    : "Select customer"}
                </option>

                {customers.map((customer) => (
                  <option
                    key={customer._id}
                    value={customer._id}
                  >
                    {customer.name} — {customer.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TYPE */}
          <div className="admin-notification-field">
            <label htmlFor="notification-type">
              Notification Type
            </label>

            <select
              id="notification-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
            >
              {TYPES.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* TITLE */}
          <div className="admin-notification-field">
            <label htmlFor="notification-title">
              Title
            </label>

            <input
              id="notification-title"
              type="text"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. System Maintenance"
              maxLength={150}
            />
          </div>

          {/* MESSAGE */}
          <div className="admin-notification-field admin-notification-full">
            <label htmlFor="notification-message">
              Message
            </label>

            <textarea
              id="notification-message"
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Enter the notification message..."
              rows={6}
              maxLength={2000}
            />

            <small>
              {message.length}/2000
            </small>
          </div>

          {/* LINK */}
          <div className="admin-notification-field">
            <label htmlFor="notification-link">
              Link (Optional)
            </label>

            <input
              id="notification-link"
              type="text"
              value={link}
              onChange={(event) =>
                setLink(event.target.value)
              }
              placeholder="/dashboard/funding"
            />
          </div>

          {/* EXPIRY */}
          <div className="admin-notification-field">
            <label htmlFor="notification-expiry">
              Expiry (Optional)
            </label>

            <input
              id="notification-expiry"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) =>
                setExpiresAt(event.target.value)
              }
            />
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="admin-notification-error">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {status && (
          <div className="admin-notification-success">
            {status}
          </div>
        )}

        {/* SEND */}
        <button
          type="submit"
          className="admin-notification-send"
          disabled={sending}
        >
          {sending
            ? "Sending..."
            : "Send Notification"}
        </button>
      </form>
    </main>
  );
}