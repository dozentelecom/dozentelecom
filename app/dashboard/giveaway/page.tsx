"use client";

import { useState } from "react";

export default function GiveawayPage() {
  const [type, setType] =
    useState<"AIRTIME" | "DATA">("AIRTIME");

  const [network, setNetwork] = useState("");
  const [amount, setAmount] = useState("");
  const [dataPlan, setDataPlan] = useState("");
  const [recipientLimit, setRecipientLimit] =
    useState("");

  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [giftLink, setGiftLink] = useState("");

  async function createGiveaway() {
    try {
      setError("");
      setMessage("");
      setGiftLink("");

      if (!network) {
        setError("Select a network.");
        return;
      }

      if (type === "AIRTIME" && !amount) {
        setError("Enter the airtime amount.");
        return;
      }

      if (type === "DATA" && !dataPlan) {
        setError("Select a data plan.");
        return;
      }

      if (!recipientLimit) {
        setError("Enter the number of recipients.");
        return;
      }

      if (!/^\d{4}$/.test(pin)) {
        setError("Enter your 4-digit transaction PIN.");
        return;
      }

      setLoading(true);

      const response = await fetch(
        "/api/giveaway/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type,
            network: Number(network),
            amount:
              type === "AIRTIME"
                ? Number(amount)
                : undefined,
            data_plan:
              type === "DATA"
                ? Number(dataPlan)
                : undefined,
            recipientLimit: Number(recipientLimit),
            pin,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create giveaway"
        );
      }

      const token =
        data?.giveaway?.token ||
        data?.token;

      const link =
        `${window.location.origin}/gift/${token}`;

      setGiftLink(link);

      setMessage(
        "🎉 Giveaway created successfully!"
      );

      setPin("");
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to create giveaway"
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!giftLink) return;

    await navigator.clipboard.writeText(giftLink);

    setMessage("Giveaway link copied!");
  }

  return (
    <main className="p-5 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-7">
          <h1 className="text-3xl font-bold">
            🎁 Create Giveaway
          </h1>

          <p className="text-gray-500 mt-2">
            Send Airtime or Data to multiple people
            using one shareable link.
          </p>
        </div>

        <div className="rounded-2xl border p-6">
          <label className="block text-sm font-medium mb-2">
            Gift Type
          </label>

          <select
            value={type}
            onChange={(e) =>
              setType(
                e.target.value as
                  | "AIRTIME"
                  | "DATA"
              )
            }
            className="w-full rounded-xl border px-4 py-3 mb-5"
          >
            <option value="AIRTIME">
              Airtime
            </option>

            <option value="DATA">
              Data
            </option>
          </select>

          <label className="block text-sm font-medium mb-2">
            Network
          </label>

          <select
            value={network}
            onChange={(e) =>
              setNetwork(e.target.value)
            }
            className="w-full rounded-xl border px-4 py-3 mb-5"
          >
            <option value="">
              Select Network
            </option>

            <option value="1">
              MTN
            </option>

            <option value="2">
              Airtel
            </option>

            <option value="3">
              GLO
            </option>

            <option value="4">
              9mobile
            </option>
          </select>

          {type === "AIRTIME" && (
            <>
              <label className="block text-sm font-medium mb-2">
                Airtime Amount
              </label>

              <input
                type="number"
                min="1"
                placeholder="100"
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3 mb-5"
              />
            </>
          )}

          {type === "DATA" && (
            <>
              <label className="block text-sm font-medium mb-2">
                Data Plan ID
              </label>

              <input
                type="number"
                placeholder="Enter SME data plan ID"
                value={dataPlan}
                onChange={(e) =>
                  setDataPlan(e.target.value)
                }
                className="w-full rounded-xl border px-4 py-3 mb-5"
              />
            </>
          )}

          <label className="block text-sm font-medium mb-2">
            Number of Recipients
          </label>

          <input
            type="number"
            min="1"
            placeholder="10"
            value={recipientLimit}
            onChange={(e) =>
              setRecipientLimit(e.target.value)
            }
            className="w-full rounded-xl border px-4 py-3 mb-5"
          />

          <label className="block text-sm font-medium mb-2">
            Transaction PIN
          </label>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) =>
              setPin(
                e.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4)
              )
            }
            className="w-full rounded-xl border px-4 py-3 mb-6"
          />

          {error && (
            <div className="rounded-xl p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl p-3 mb-4 text-sm">
              {message}
            </div>
          )}

          <button
            type="button"
            onClick={createGiveaway}
            disabled={loading}
            className="w-full rounded-xl px-5 py-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? "Creating Giveaway..."
              : "🎁 Create Giveaway"}
          </button>
        </div>

        {giftLink && (
          <div className="mt-6 rounded-2xl border p-6">
            <h2 className="font-bold text-lg mb-3">
              Your Giveaway Link
            </h2>

            <div className="rounded-xl border p-3 break-all text-sm mb-4">
              {giftLink}
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="w-full rounded-xl px-5 py-3 font-semibold"
            >
              📋 Copy Giveaway Link
            </button>

            <p className="text-sm text-gray-500 mt-4">
              Send this link to your recipients.
              They only need to enter their phone
              number to receive the gift.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}