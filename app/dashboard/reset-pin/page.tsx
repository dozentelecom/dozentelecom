"use client";

import { useState } from "react";

import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import BackButton from "@/components/dashboard/BackButton";

export default function ResetPinPage() {

  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  async function resetPin() {

    setError("");
    setMessage("");

    if (
      newPin.length !== 4 ||
      !/^\d{4}$/.test(newPin)
    ) {

      setError(
        "New PIN must be exactly 4 digits."
      );

      return;
    }

    if (newPin !== confirmPin) {

      setError(
        "New PIN and confirmation PIN do not match."
      );

      return;
    }

    setLoading(true);

    try {

      const r = await fetch(
        "/api/customer/reset-pin",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            oldPin,
            newPin
          })
        }
      );

      const text = await r.text();

let j: any = {};

try {
  j = text ? JSON.parse(text) : {};
} catch {
  throw new Error(
    `Server returned an invalid response (${r.status})`
  );
}

if (!r.ok) {
  throw new Error(
    j.error ||
    j.message ||
    `Unable to reset PIN (${r.status})`
  );
}

      setMessage(
        "Transaction PIN changed successfully."
      );

      setOldPin("");
      setNewPin("");
      setConfirmPin("");

    } catch (e: any) {

      setError(
        e.message ||
        "Unable to reset PIN"
      );

    } finally {

      setLoading(false);

    }

  }

  return (

    <div className="dashboard-layout">

      <DashboardSidebar />

      <main className="dashboard-main page">

        <BackButton />

        <div className="section-head">

          <div>

            <div className="eyebrow">
              SECURITY
            </div>

            <h1>Reset Transaction PIN</h1>

            <p className="muted">
              Change your secure 4-digit transaction PIN.
            </p>

          </div>

        </div>

        {error && (

          <div className="alert error">
            {error}
          </div>

        )}

        {message && (

          <div className="alert success">
            {message}
          </div>

        )}

        <div className="card pin-card">

          <label className="field">

            <span>Current PIN</span>

            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={oldPin}
              onChange={e =>
                setOldPin(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                )
              }
            />

          </label>

          <label className="field">

            <span>New PIN</span>

            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={e =>
                setNewPin(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                )
              }
            />

          </label>

          <label className="field">

            <span>Confirm New PIN</span>

            <input
              className="input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={e =>
                setConfirmPin(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 4)
                )
              }
            />

          </label>

          <button
            className="btn primary"
            type="button"
            onClick={resetPin}
            disabled={loading}
          >

            {loading
              ? "Updating PIN..."
              : "Reset PIN"}

          </button>

        </div>

      </main>

    </div>

  );
}