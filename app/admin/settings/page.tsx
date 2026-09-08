"use client";

import { useEffect, useState } from "react";

type SettingsState = {
  /* Normal service rates */
  data: number;
  electricity: number;
  cable: number;
  education: number;
  airtimeToCash: number;
  funding: number;
  withdrawal: number;
  airtimeRoundUnit: number;

  /* VIP membership prices */
  vip1Price: number;
  vip2Price: number;
  vip3Price: number;

  /* VIP1 service rates */
  vip1Data: number;
  vip1Electricity: number;
  vip1Cable: number;
  vip1Education: number;
  vip1AirtimeToCash: number;

  /* VIP2 service rates */
  vip2Data: number;
  vip2Electricity: number;
  vip2Cable: number;
  vip2Education: number;
  vip2AirtimeToCash: number;

  /* VIP3 service rates */
  vip3Data: number;
  vip3Electricity: number;
  vip3Cable: number;
  vip3Education: number;
  vip3AirtimeToCash: number;
};

const DEFAULT_SETTINGS: SettingsState = {
  /* Normal */
  data: 5,
  electricity: 4,
  cable: 4,
  education: 15,
  airtimeToCash: 20,
  funding: 1.5,
  withdrawal: 0,
  airtimeRoundUnit: 10,

  /* VIP membership */
  vip1Price: 5000,
  vip2Price: 15000,
  vip3Price: 30000,

  /* VIP1 */
  vip1Data: 4,
  vip1Electricity: 3,
  vip1Cable: 3,
  vip1Education: 12,
  vip1AirtimeToCash: 18,

  /* VIP2 */
  vip2Data: 3,
  vip2Electricity: 2,
  vip2Cable: 2,
  vip2Education: 10,
  vip2AirtimeToCash: 15,

  /* VIP3 */
  vip3Data: 2,
  vip3Electricity: 1,
  vip3Cable: 1,
  vip3Education: 8,
  vip3AirtimeToCash: 12,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] =
    useState<SettingsState>(
      DEFAULT_SETTINGS
    );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  /* =========================================================
     LOAD SETTINGS
     ========================================================= */

  async function loadSettings() {
    try {
      const res = await fetch(
        "/api/admin/settings"
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to load settings"
        );
      }

      if (data.settings?.rates) {
        const rates =
          data.settings.rates;

        setSettings({
          /* =========================
             NORMAL SERVICE RATES
             ========================= */

          data: Number(
            rates.data ?? 5
          ),

          electricity: Number(
            rates.electricity ?? 4
          ),

          cable: Number(
            rates.cable ?? 4
          ),

          education: Number(
            rates.education ?? 15
          ),

          airtimeToCash: Number(
            rates.airtimeToCash ?? 20
          ),

          funding: Number(
            rates.funding ?? 1.5
          ),

          withdrawal: Number(
            rates.withdrawal ?? 0
          ),

          airtimeRoundUnit: Number(
            rates.airtimeRoundUnit ?? 10
          ),

          /* =========================
             VIP MEMBERSHIP PRICES
             ========================= */

          vip1Price: Number(
            rates.vip1Price ?? 5000
          ),

          vip2Price: Number(
            rates.vip2Price ?? 15000
          ),

          vip3Price: Number(
            rates.vip3Price ?? 30000
          ),

          /* =========================
             VIP1 SERVICE RATES
             ========================= */

          vip1Data: Number(
            rates.vip1Data ?? 4
          ),

          vip1Electricity: Number(
            rates.vip1Electricity ?? 3
          ),

          vip1Cable: Number(
            rates.vip1Cable ?? 3
          ),

          vip1Education: Number(
            rates.vip1Education ?? 12
          ),

          vip1AirtimeToCash: Number(
            rates.vip1AirtimeToCash ?? 18
          ),

          /* =========================
             VIP2 SERVICE RATES
             ========================= */

          vip2Data: Number(
            rates.vip2Data ?? 3
          ),

          vip2Electricity: Number(
            rates.vip2Electricity ?? 2
          ),

          vip2Cable: Number(
            rates.vip2Cable ?? 2
          ),

          vip2Education: Number(
            rates.vip2Education ?? 10
          ),

          vip2AirtimeToCash: Number(
            rates.vip2AirtimeToCash ?? 15
          ),

          /* =========================
             VIP3 SERVICE RATES
             ========================= */

          vip3Data: Number(
            rates.vip3Data ?? 2
          ),

          vip3Electricity: Number(
            rates.vip3Electricity ?? 1
          ),

          vip3Cable: Number(
            rates.vip3Cable ?? 1
          ),

          vip3Education: Number(
            rates.vip3Education ?? 8
          ),

          vip3AirtimeToCash: Number(
            rates.vip3AirtimeToCash ?? 12
          ),
        });
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Unable to load settings"
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     UPDATE FIELD
     ========================================================= */

  function update(
    field: keyof SettingsState,
    value: string
  ) {
    setSettings((current) => ({
      ...current,
      [field]:
        value === ""
          ? 0
          : Number(value),
    }));
  }

  /* =========================================================
     SAVE SETTINGS
     ========================================================= */

  async function saveSettings(
    e: React.FormEvent
  ) {
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
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(settings),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
            "Unable to save settings"
        );
      }

      setMessage(
        "Settings saved successfully."
      );

      /*
       * Reload from database so the UI
       * reflects exactly what was saved.
       */
      if (data.settings?.rates) {
        const rates =
          data.settings.rates;

        setSettings({
          ...DEFAULT_SETTINGS,

          data: Number(
            rates.data ?? 5
          ),

          electricity: Number(
            rates.electricity ?? 4
          ),

          cable: Number(
            rates.cable ?? 4
          ),

          education: Number(
            rates.education ?? 15
          ),

          airtimeToCash: Number(
            rates.airtimeToCash ?? 20
          ),

          funding: Number(
            rates.funding ?? 1.5
          ),

          withdrawal: Number(
            rates.withdrawal ?? 0
          ),

          airtimeRoundUnit: Number(
            rates.airtimeRoundUnit ?? 10
          ),

          vip1Price: Number(
            rates.vip1Price ?? 5000
          ),

          vip2Price: Number(
            rates.vip2Price ?? 15000
          ),

          vip3Price: Number(
            rates.vip3Price ?? 30000
          ),

          vip1Data: Number(
            rates.vip1Data ?? 4
          ),

          vip1Electricity: Number(
            rates.vip1Electricity ?? 3
          ),

          vip1Cable: Number(
            rates.vip1Cable ?? 3
          ),

          vip1Education: Number(
            rates.vip1Education ?? 12
          ),

          vip1AirtimeToCash: Number(
            rates.vip1AirtimeToCash ?? 18
          ),

          vip2Data: Number(
            rates.vip2Data ?? 3
          ),

          vip2Electricity: Number(
            rates.vip2Electricity ?? 2
          ),

          vip2Cable: Number(
            rates.vip2Cable ?? 2
          ),

          vip2Education: Number(
            rates.vip2Education ?? 10
          ),

          vip2AirtimeToCash: Number(
            rates.vip2AirtimeToCash ?? 15
          ),

          vip3Data: Number(
            rates.vip3Data ?? 2
          ),

          vip3Electricity: Number(
            rates.vip3Electricity ?? 1
          ),

          vip3Cable: Number(
            rates.vip3Cable ?? 1
          ),

          vip3Education: Number(
            rates.vip3Education ?? 8
          ),

          vip3AirtimeToCash: Number(
            rates.vip3AirtimeToCash ?? 12
          ),
        });
      }
    } catch (err: any) {
      setError(
        err.message ||
          "Unable to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================================================
     LOADING
     ========================================================= */

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

  /* =========================================================
     UI
     ========================================================= */

  return (
    <main className="dashboard-content">
      <div className="dashboard-top">
        <div className="eyebrow">
          ADMINISTRATION
        </div>

        <h1>Settings</h1>

        <p className="muted">
          Manage platform rates,
          pricing and VIP membership.
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
        {/* =====================================================
            SERVICE RATES
            ===================================================== */}

        <h2>Service Rates</h2>

        <p className="muted">
          Configure the percentage added
          to each service price. VIP users
          can have lower rates than normal
          users.
        </p>

        {/* =====================================================
            NORMAL RATES
            ===================================================== */}

        <h3>Normal User Rates</h3>

        <div className="admin-settings-grid">
          <label className="field">
            <span>Data Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="15"
              value={settings.data}
              onChange={(e) =>
                update(
                  "data",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Electricity Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.electricity
              }
              onChange={(e) =>
                update(
                  "electricity",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Cable TV Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={settings.cable}
              onChange={(e) =>
                update(
                  "cable",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Education Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="25"
              value={
                settings.education
              }
              onChange={(e) =>
                update(
                  "education",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Airtime to Cash Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="30"
              value={
                settings.airtimeToCash
              }
              onChange={(e) =>
                update(
                  "airtimeToCash",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* =====================================================
            VIP1 RATES
            ===================================================== */}

        <hr />

        <h3>VIP1 Service Rates</h3>

        <p className="muted">
          Rates applied to VIP1
          customers.
        </p>

        <div className="admin-settings-grid">
          <label className="field">
            <span>Data Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="15"
              value={settings.vip1Data}
              onChange={(e) =>
                update(
                  "vip1Data",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Electricity Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip1Electricity
              }
              onChange={(e) =>
                update(
                  "vip1Electricity",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Cable TV Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip1Cable
              }
              onChange={(e) =>
                update(
                  "vip1Cable",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Education Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="25"
              value={
                settings.vip1Education
              }
              onChange={(e) =>
                update(
                  "vip1Education",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Airtime to Cash Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="30"
              value={
                settings.vip1AirtimeToCash
              }
              onChange={(e) =>
                update(
                  "vip1AirtimeToCash",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* =====================================================
            VIP2 RATES
            ===================================================== */}

        <hr />

        <h3>VIP2 Service Rates</h3>

        <p className="muted">
          Rates applied to VIP2
          customers.
        </p>

        <div className="admin-settings-grid">
          <label className="field">
            <span>Data Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="15"
              value={settings.vip2Data}
              onChange={(e) =>
                update(
                  "vip2Data",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Electricity Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip2Electricity
              }
              onChange={(e) =>
                update(
                  "vip2Electricity",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Cable TV Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip2Cable
              }
              onChange={(e) =>
                update(
                  "vip2Cable",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Education Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="25"
              value={
                settings.vip2Education
              }
              onChange={(e) =>
                update(
                  "vip2Education",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Airtime to Cash Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="30"
              value={
                settings.vip2AirtimeToCash
              }
              onChange={(e) =>
                update(
                  "vip2AirtimeToCash",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* =====================================================
            VIP3 RATES
            ===================================================== */}

        <hr />

        <h3>VIP3 Service Rates</h3>

        <p className="muted">
          Rates applied to VIP3
          customers.
        </p>

        <div className="admin-settings-grid">
          <label className="field">
            <span>Data Rate (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="15"
              value={settings.vip3Data}
              onChange={(e) =>
                update(
                  "vip3Data",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Electricity Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip3Electricity
              }
              onChange={(e) =>
                update(
                  "vip3Electricity",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Cable TV Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={
                settings.vip3Cable
              }
              onChange={(e) =>
                update(
                  "vip3Cable",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Education Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="25"
              value={
                settings.vip3Education
              }
              onChange={(e) =>
                update(
                  "vip3Education",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Airtime to Cash Rate (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="30"
              value={
                settings.vip3AirtimeToCash
              }
              onChange={(e) =>
                update(
                  "vip3AirtimeToCash",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* =====================================================
            OTHER NORMAL SETTINGS
            ===================================================== */}

        <hr />

        <h3>Platform Settings</h3>

        <div className="admin-settings-grid">
          <label className="field">
            <span>Funding Fee (%)</span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="5"
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
            <span>
              Withdrawal Fee (%)
            </span>

            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              max="5"
              value={
                settings.withdrawal
              }
              onChange={(e) =>
                update(
                  "withdrawal",
                  e.target.value
                )
              }
            />
          </label>

          <label className="field">
            <span>
              Airtime Round Unit (₦)
            </span>

            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={
                settings.airtimeRoundUnit
              }
              onChange={(e) =>
                update(
                  "airtimeRoundUnit",
                  e.target.value
                )
              }
            />
          </label>
        </div>

        {/* =====================================================
            VIP MEMBERSHIP
            ===================================================== */}

        <hr />

        <h2>VIP Membership</h2>

        <p className="muted">
          Set the total membership price
          for each VIP level. Customers
          pay only the difference when
          upgrading to the next level.
        </p>

        <div className="admin-settings-grid">
          <label className="field">
            <span>
              VIP 1 Price (₦)
            </span>

            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={
                settings.vip1Price
              }
              onChange={(e) =>
                update(
                  "vip1Price",
                  e.target.value
                )
              }
            />

            <small className="muted">
              Normal User → VIP1
            </small>
          </label>

          <label className="field">
            <span>
              VIP 2 Price (₦)
            </span>

            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={
                settings.vip2Price
              }
              onChange={(e) =>
                update(
                  "vip2Price",
                  e.target.value
                )
              }
            />

            <small className="muted">
              Total price to reach VIP2
            </small>
          </label>

          <label className="field">
            <span>
              VIP 3 Price (₦)
            </span>

            <input
              className="input"
              type="number"
              step="1"
              min="1"
              value={
                settings.vip3Price
              }
              onChange={(e) =>
                update(
                  "vip3Price",
                  e.target.value
                )
              }
            />

            <small className="muted">
              Total price to reach VIP3
            </small>
          </label>
        </div>

        {/* =====================================================
            SAVE
            ===================================================== */}

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