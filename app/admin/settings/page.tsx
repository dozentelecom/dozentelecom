"use client";

import { useEffect, useState } from "react";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    data: 5,
    electricity: 4,
    cable: 4,
    education: 15,
    airtimeToCash: 20,
    funding: 1.5,
    airtimeRoundUnit: 10,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/admin/settings");

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to load settings");
      }

      if (data.settings?.rates) {
        setSettings({
          data: Number(data.settings.rates.data ?? 0),
          electricity: Number(
            data.settings.rates.electricity ?? 0
          ),
          cable: Number(data.settings.rates.cable ?? 0),
          education: Number(
            data.settings.rates.education ?? 0
          ),
          airtimeToCash: Number(
            data.settings.rates.airtimeToCash ?? 0
          ),
          funding: Number(
            data.settings.rates.funding ?? 0
          ),
          airtimeRoundUnit: Number(
            data.settings.rates.airtimeRoundUnit ?? 100
          ),
        });
      }

    } catch (err: any) {
      setError(
        err.message || "Unable to load settings"
      );
    } finally {
      setLoading(false);
    }
  }

  function update(
    field: keyof typeof settings,
    value: string
  ) {
    setSettings((current) => ({
      ...current,
      [field]: Number(value),
    }));
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(
        "/api/admin/settings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(settings),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Unable to save settings"
        );
      }

      setMessage(
        "Settings saved successfully."
      );

    } catch (err: any) {
      setError(
        err.message || "Unable to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-content">
        <h1>Admin Settings</h1>
        <p className="muted">
          Loading settings...
        </p>
      </main>
    );
  }

  return (
    <main className="dashboard-content">

      <div className="dashboard-top">
        <div className="eyebrow">
          ADMINISTRATION
        </div>

        <h1>Settings</h1>

        <p className="muted">
          Manage your platform rates and pricing.
        </p>
      </div>

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      <form
        onSubmit={saveSettings}
        className="card"
      >

        <h2>Service Rates</h2>

        <p className="muted">
          Enter percentages used by the platform.
        </p>

        <div className="admin-settings-grid">

          <label className="field">
            <span>Data Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.data}
              onChange={(e) =>
                update("data", e.target.value)
              }
            />
          </label>

          <label className="field">
            <span>Electricity Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.electricity}
              onChange={(e) =>
                update(
                  "electricity",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>Cable TV Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.cable}
              onChange={(e) =>
                update("cable", e.target.value)
              }
            />
          </label>

          <label className="field">
            <span>Education Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.education}
              onChange={(e) =>
                update(
                  "education",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>Airtime to Cash Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.airtimeToCash}
              onChange={(e) =>
                update(
                  "airtimeToCash",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>Funding Fee (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              value={settings.funding}
              onChange={(e) =>
                update(
                  "funding",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>Airtime Round Unit (₦)</span>

            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={settings.airtimeRoundUnit}
              onChange={(e) =>
                update(
                  "airtimeRoundUnit",
                  e.target.value
                )
              }
            />
          </label>

        </div>

        <button
          className="btn primary"
          type="submit"
          disabled={saving}
        >
          {saving
            ? "Saving..."
            : "Save Settings"}
        </button>

      </form>

    </main>
  );
}