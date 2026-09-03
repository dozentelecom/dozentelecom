"use client";

import { useState } from "react";

export default function CreatePinPopup() {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);

  async function createPin() {
    setError("");

    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirm) {
      setError("PINs do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/customer/create-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pin,
          confirm,
        }),
      });

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Invalid server response.");
      }

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to create PIN."
        );
      }

      setOpen(false);

      window.location.reload();
    } catch (error: any) {
      setError(error.message || "Unable to create PIN.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="pin-popup-overlay">
      <div className="pin-popup">
        <div className="eyebrow">SECURITY</div>

        <h2>Create Transaction PIN</h2>

        <p className="muted">
          You need a 4-digit transaction PIN before you can purchase
          services or perform wallet transactions.
        </p>

        {error && (
          <div className="alert error">
            {error}
          </div>
        )}

        <label className="field">
          <span>Create 4-digit PIN</span>

          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) =>
              setPin(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
          />
        </label>

        <label className="field">
          <span>Confirm PIN</span>

          <input
            className="input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirm}
            onChange={(e) =>
              setConfirm(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
          />
        </label>

        <button
          type="button"
          className="btn primary"
          onClick={createPin}
          disabled={loading}
        >
          {loading ? "Creating PIN..." : "Create Transaction PIN"}
        </button>

        <p className="muted pin-popup-note">
          This message will disappear permanently after your PIN is
          created.
        </p>
      </div>
    </div>
  );
}