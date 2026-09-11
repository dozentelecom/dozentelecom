"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type VipLevel =
  | "NORMAL"
  | "VIP1"
  | "VIP2"
  | "VIP3";

type VipInfo = {
  success: boolean;
  vipLevel: VipLevel;
  nextLevel: VipLevel | null;

  currentTotal: number;
  targetTotal: number;
  upgradePrice: number;

  walletBalanceKobo: number;
  walletBalanceNaira: number;

  prices: {
    vip1: number;
    vip2: number;
    vip3: number;
  };
};

const VIP_ORDER: Record<VipLevel, number> = {
  NORMAL: 0,
  VIP1: 1,
  VIP2: 2,
  VIP3: 3,
};

export default function VipUpgradePage() {
  const router = useRouter();

  const [info, setInfo] =
    useState<VipInfo | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [upgrading, setUpgrading] =
    useState(false);

  const [showPin, setShowPin] =
    useState(false);

  const [selectedLevel, setSelectedLevel] =
    useState<VipLevel | null>(null);

  const [pin, setPin] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadVipInfo();
  }, []);

  async function loadVipInfo() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/vip",
        {
          cache: "no-store",
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to load VIP information."
        );
      }

      setInfo(data);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load VIP information."
      );
    } finally {
      setLoading(false);
    }
  }

  function getCurrentPrice(): number {
    if (!info) return 0;

    if (info.vipLevel === "NORMAL") {
      return 0;
    }

    if (info.vipLevel === "VIP1") {
      return Number(info.prices?.vip1 || 0);
    }

    if (info.vipLevel === "VIP2") {
      return Number(info.prices?.vip2 || 0);
    }

    return Number(info.prices?.vip3 || 0);
  }

  function getTargetPrice(
    level: VipLevel
  ): number {
    if (!info) return 0;

    if (level === "VIP1") {
      return Number(info.prices?.vip1 || 0);
    }

    if (level === "VIP2") {
      return Number(info.prices?.vip2 || 0);
    }

    if (level === "VIP3") {
      return Number(info.prices?.vip3 || 0);
    }

    return 0;
  }

  function getUpgradeCost(
    level: VipLevel
  ): number {
    const targetPrice =
      getTargetPrice(level);

    const currentPrice =
      getCurrentPrice();

    return Math.max(
      0,
      targetPrice - currentPrice
    );
  }

  function isHigherLevel(
    level: VipLevel
  ): boolean {
    if (!info || level === "NORMAL") {
      return false;
    }

    return (
      VIP_ORDER[level] >
      VIP_ORDER[info.vipLevel]
    );
  }

  function formatNaira(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "en-NG",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  function formatWholeNaira(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "en-NG"
    );
  }

  function openConfirmation(
    level: VipLevel
  ) {
    setError("");
    setMessage("");

    if (!info) return;

    if (!isHigherLevel(level)) {
      setError(
        "You can only upgrade to a higher VIP level."
      );
      return;
    }

    const upgradeCost =
      getUpgradeCost(level);

    if (upgradeCost <= 0) {
      setError(
        "VIP upgrade price is not configured."
      );
      return;
    }

    const walletBalance =
      Number(
        info.walletBalanceNaira || 0
      );

    if (walletBalance < upgradeCost) {
      setError(
        "Your wallet balance is insufficient for this upgrade."
      );
      return;
    }

    setSelectedLevel(level);
    setPin("");
    setShowPin(true);
  }

  async function confirmUpgrade() {
    if (upgrading) return;

    setError("");
    setMessage("");

    if (!selectedLevel) {
      setError(
        "Please select a VIP level."
      );
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(
        "Enter your 4-digit transaction PIN."
      );
      return;
    }

    try {
      setUpgrading(true);

      const response =
        await fetch(
          "/api/vip/upgrade",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              pin,
              targetLevel:
                selectedLevel,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "VIP upgrade failed."
        );
      }

      setShowPin(false);
      setPin("");

      setMessage(
        data?.message ||
          `Successfully upgraded to ${data?.vipLevel}.`
      );

      setSelectedLevel(null);

      router.refresh();

      await loadVipInfo();
    } catch (err: any) {
      setError(
        err?.message ||
          "VIP upgrade failed. Please try again."
      );
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return (
      <main className="vip-page">
        <div className="vip-loading">
          Loading VIP information...
        </div>

        <style>{styles}</style>
      </main>
    );
  }

  if (!info) {
    return (
      <main className="vip-page">
        <div className="vip-card">
          <h1>VIP Upgrade</h1>

          <p className="error-text">
            {error ||
              "Unable to load VIP information."}
          </p>

          <button
            type="button"
            className="primary-button"
            onClick={loadVipInfo}
          >
            Try again
          </button>
        </div>

        <style>{styles}</style>
      </main>
    );
  }

  const walletBalance =
    Number(
      info.walletBalanceNaira || 0
    );

  const vipLevels: VipLevel[] = [
    "VIP1",
    "VIP2",
    "VIP3",
  ];

  return (
    <main className="vip-page">
      <div className="vip-container">

        {/* HEADER */}
        <div className="vip-header">
          <div>
            <p className="eyebrow">
              Dozentelecom
            </p>

            <h1>
              VIP Upgrade
            </h1>

            <p className="subtitle">
              Choose any higher VIP level and
              enjoy your configured VIP service
              rates.
            </p>
          </div>

          <div className="current-vip">
            <span>
              Current level
            </span>

            <strong>
              {info.vipLevel}
            </strong>
          </div>
        </div>

        {/* MESSAGES */}
        {message && (
          <div className="success-box">
            {message}
          </div>
        )}

        {error && (
          <div className="error-box">
            {error}
          </div>
        )}

        {/* WALLET */}
        <div className="wallet-card">
          <div>
            <span>
              Available wallet balance
            </span>

            <strong>
              ₦{formatNaira(walletBalance)}
            </strong>
          </div>
        </div>

        {/* VIP LEVELS */}
        <div className="levels-grid">
          {vipLevels.map((level) => {
            const price =
              getTargetPrice(level);

            const cost =
              getUpgradeCost(level);

            const active =
              info.vipLevel === level;

            const available =
              isHigherLevel(level);

            const affordable =
              walletBalance >= cost;

            return (
              <div
                key={level}
                className={
                  "vip-level-card " +
                  (active
                    ? "current"
                    : "") +
                  (!available
                    ? "locked"
                    : "")
                }
              >
                <div className="level-card-top">
                  <div>
                    <span className="small-label">
                      Membership
                    </span>

                    <h2>
                      {level}
                    </h2>
                  </div>

                  <div className="vip-star">
                    ★
                  </div>
                </div>

                <div className="level-price">
                  ₦
                  {formatWholeNaira(
                    price
                  )}
                </div>

                {active ? (
                  <div className="status-badge current-badge">
                    Current Level
                  </div>
                ) : available ? (
                  <>
                    <div className="upgrade-cost">
                      <span>
                        Upgrade cost
                      </span>

                      <strong>
                        ₦
                        {formatNaira(
                          cost
                        )}
                      </strong>
                    </div>

                    {!affordable && (
                      <div className="mini-warning">
                        Insufficient wallet
                        balance
                      </div>
                    )}

                    <button
                      type="button"
                      className="primary-button upgrade-button"
                      onClick={() =>
                        openConfirmation(
                          level
                        )
                      }
                      disabled={
                        upgrading ||
                        !affordable ||
                        cost <= 0
                      }
                    >
                      Upgrade to {level}
                    </button>
                  </>
                ) : (
                  <div className="status-badge locked-badge">
                    Already passed
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* PRICING EXPLANATION */}
        <div className="pricing-card">
          <h3>
            How VIP upgrade pricing works
          </h3>

          <p>
            VIP prices are cumulative. You only
            pay the difference between your
            current VIP level and the VIP level
            you choose.
          </p>

          <div className="pricing-list">

            <div className="level-row">
              <span>
                Normal → VIP1
              </span>

              <strong>
                ₦
                {formatWholeNaira(
                  info.prices?.vip1
                )}
              </strong>
            </div>

            <div className="level-row">
              <span>
                Normal → VIP2
              </span>

              <strong>
                ₦
                {formatWholeNaira(
                  info.prices?.vip2
                )}
              </strong>
            </div>

            <div className="level-row">
              <span>
                Normal → VIP3
              </span>

              <strong>
                ₦
                {formatWholeNaira(
                  info.prices?.vip3
                )}
              </strong>
            </div>

          </div>

          <p className="pricing-note">
            Example: if VIP1 is ₦5,000 and
            VIP2 is ₦15,000, a VIP1 customer
            pays only ₦10,000 to upgrade to
            VIP2.
          </p>
        </div>
      </div>

      {/* PIN MODAL */}
      {showPin && selectedLevel && (
        <div className="modal-backdrop">

          <div
            className="pin-modal"
            role="dialog"
            aria-modal="true"
          >

            <div className="modal-icon">
              🔐
            </div>

            <h2>
              Confirm VIP Upgrade
            </h2>

            <p>
              Enter your 4-digit transaction PIN
              to confirm this upgrade.
            </p>

            <div className="confirm-summary">

              <span>
                Current level
              </span>

              <strong>
                {info.vipLevel}
              </strong>

              <span>
                Upgrade to
              </span>

              <strong>
                {selectedLevel}
              </strong>

              <span>
                Amount
              </span>

              <strong>
                ₦
                {formatNaira(
                  getUpgradeCost(
                    selectedLevel
                  )
                )}
              </strong>

            </div>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) =>
                setPin(
                  e.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(0, 4)
                )
              }
              placeholder="Enter PIN"
              className="pin-input"
              autoFocus
              disabled={upgrading}
            />

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  if (!upgrading) {
                    setShowPin(false);
                    setPin("");
                    setSelectedLevel(null);
                  }
                }}
                disabled={
                  upgrading
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={
                  confirmUpgrade
                }
                disabled={
                  upgrading ||
                  pin.length !== 4
                }
              >
                {upgrading
                  ? "Processing..."
                  : "Confirm Upgrade"}
              </button>

            </div>

          </div>
        </div>
      )}

      <style>{styles}</style>
    </main>
  );
}

const styles = `
.vip-page {
  min-height: 100vh;
  width: 100%;
  box-sizing: border-box;
  padding: clamp(20px, 4vw, 40px);
  background: #f8fafc;
}

.vip-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.vip-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 24px;
}

.eyebrow {
  margin: 0 0 5px;
  color: #0d6efd;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.vip-header h1 {
  margin: 0;
  font-size: clamp(27px, 5vw, 38px);
  color: #0f172a;
}

.subtitle {
  margin: 8px 0 0;
  color: #64748b;
  max-width: 650px;
  line-height: 1.5;
}

.current-vip {
  flex-shrink: 0;
  padding: 14px 18px;
  border-radius: 14px;
  background: #071a33;
  color: white;
  text-align: center;
}

.current-vip span {
  display: block;
  font-size: 11px;
  color: #bfdbfe;
  margin-bottom: 5px;
}

.current-vip strong {
  font-size: 18px;
}

.wallet-card {
  background: #071a33;
  color: white;
  border-radius: 18px;
  padding: 20px 22px;
  margin-bottom: 18px;
  box-shadow:
    0 8px 25px
    rgba(15, 23, 42, .08);
}

.wallet-card span {
  display: block;
  color: #bfdbfe;
  font-size: 12px;
  margin-bottom: 5px;
}

.wallet-card strong {
  font-size: clamp(24px, 5vw, 32px);
}

.levels-grid {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.vip-level-card,
.pricing-card,
.vip-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 22px;
  box-shadow:
    0 8px 25px
    rgba(15, 23, 42, .06);
}

.vip-level-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.vip-level-card.current {
  border: 2px solid #0d6efd;
}

.vip-level-card.locked {
  opacity: .65;
}

.level-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.small-label {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 5px;
}

.level-card-top h2 {
  margin: 0;
  color: #0f172a;
  font-size: 27px;
}

.vip-star {
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #0d6efd;
  font-size: 22px;
}

.level-price {
  margin-top: 22px;
  color: #0f172a;
  font-size: 27px;
  font-weight: 900;
}

.upgrade-cost {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 12px;
}

.upgrade-cost strong {
  color: #0f172a;
  font-size: 14px;
}

.status-badge {
  margin-top: 18px;
  padding: 10px;
  border-radius: 10px;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
}

.current-badge {
  background: #eff6ff;
  color: #0d6efd;
}

.locked-badge {
  background: #f1f5f9;
  color: #64748b;
}

.mini-warning {
  margin-top: 12px;
  padding: 9px 10px;
  border-radius: 9px;
  background: #fffbeb;
  color: #92400e;
  font-size: 11px;
  text-align: center;
}

.primary-button,
.cancel-button {
  border: 0;
  border-radius: 11px;
  padding: 12px 18px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.primary-button {
  background: #0d6efd;
  color: white;
}

.primary-button:hover {
  background: #0b5ed7;
}

.primary-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.upgrade-button {
  width: 100%;
  margin-top: 16px;
}

.pricing-card {
  margin-bottom: 18px;
}

.pricing-card h3 {
  margin: 0;
  color: #0f172a;
  font-size: 20px;
}

.pricing-card > p {
  color: #64748b;
  line-height: 1.5;
  font-size: 13px;
}

.pricing-list {
  margin-top: 15px;
}

.level-row {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  padding: 13px 0;
  border-bottom: 1px solid #e2e8f0;
  color: #475569;
}

.level-row:last-child {
  border-bottom: 0;
}

.level-row strong {
  color: #0f172a;
}

.pricing-note {
  color: #64748b;
  font-size: 12px !important;
  line-height: 1.5;
}

.error-box,
.success-box {
  border-radius: 11px;
  padding: 12px 14px;
  margin-bottom: 15px;
  font-size: 13px;
  line-height: 1.45;
}

.error-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.success-box {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.error-text {
  color: #b91c1c;
  margin-bottom: 15px;
}

.vip-loading {
  text-align: center;
  color: #64748b;
  padding: 60px 20px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(2, 6, 23, .65);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}

.pin-modal {
  width: 100%;
  max-width: 430px;
  background: white;
  border-radius: 20px;
  padding: 25px;
  box-shadow:
    0 25px 70px
    rgba(0, 0, 0, .3);
  box-sizing: border-box;
}

.modal-icon {
  font-size: 28px;
  margin-bottom: 10px;
}

.pin-modal h2 {
  margin: 0;
  color: #0f172a;
}

.pin-modal > p {
  color: #64748b;
  line-height: 1.5;
}

.confirm-summary {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 14px;
  background: #f8fafc;
  border-radius: 12px;
  margin: 18px 0;
}

.confirm-summary span {
  color: #64748b;
}

.confirm-summary strong {
  color: #0f172a;
}

.pin-input {
  width: 100%;
  box-sizing: border-box;
  padding: 14px;
  border: 1px solid #cbd5e1;
  border-radius: 11px;
  font-size: 22px;
  letter-spacing: 8px;
  text-align: center;
  outline: none;
}

.pin-input:focus {
  border-color: #0d6efd;
  box-shadow:
    0 0 0 3px
    rgba(13, 110, 253, .12);
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.modal-actions button {
  flex: 1;
}

.cancel-button {
  background: #e2e8f0;
  color: #334155;
}

@media (max-width: 800px) {
  .levels-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .vip-page {
    padding: 16px 12px;
  }

  .vip-header {
    flex-direction: column;
  }

  .current-vip {
    width: 100%;
    box-sizing: border-box;
  }

  .levels-grid {
    grid-template-columns: 1fr;
  }

  .vip-level-card {
    padding: 18px;
  }

  .level-price {
    font-size: 25px;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }
}
`;