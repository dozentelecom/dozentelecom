"use client";

import { useEffect, useState } from "react";

type Giveaway = {
  token: string;
  type: "AIRTIME" | "DATA";
  network: number;
  amount?: number;
  dataPlanId?: string;
  dataPlanName?: string;
  recipientLimit: number;
  claimedCount: number;
  remaining: number;
  expiresAt?: string | null;
  status: string;
  active: boolean;
};

export default function GiftPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [giveaway, setGiveaway] =
    useState<Giveaway | null>(null);

const [token, setToken] = useState("");

  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  useEffect(() => {
  async function getToken() {
    const resolvedParams = await params;
    setToken(resolvedParams.token);
  }

  getToken();
}, [params]);

useEffect(() => {
  if (token) {
    loadGiveaway();
  }
}, [token]);

  async function loadGiveaway() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/giveaway/${token}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load giveaway"
        );
      }

      setGiveaway(data.giveaway);
    } catch (err: any) {
      setError(
        err?.message || "Unable to load giveaway"
      );
    } finally {
      setLoading(false);
    }
  }

  async function claimGift() {
    try {
      setError("");

      const cleanPhone = phone.replace(/\D/g, "");

      if (!/^[0-9]{11}$/.test(cleanPhone)) {
        setError(
          "Please enter a valid 11-digit Nigerian phone number."
        );
        return;
      }

      setClaiming(true);

      const response = await fetch(
        `/api/giveaway/${token}/claim`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: cleanPhone,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to claim giveaway"
        );
      }

      setSuccess(data.gift);

      setGiveaway((current) =>
        current
          ? {
              ...current,
              claimedCount:
                current.claimedCount + 1,
              remaining:
                Math.max(
                  0,
                  current.remaining - 1
                ),
            }
          : current
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to claim giveaway. Please try again."
      );
    } finally {
      setClaiming(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎁</div>
          <p>Loading your gift...</p>
        </div>
      </main>
    );
  }

  if (error && !giveaway) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border p-6 text-center">
          <div className="text-5xl mb-4">🎁</div>

          <h1 className="text-2xl font-bold mb-2">
            Giveaway unavailable
          </h1>

          <p className="text-gray-500">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (success) {
    const amount =
      success.type === "AIRTIME"
        ? `₦${Number(success.amount).toLocaleString()}`
        : success.planName;

    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border shadow-lg p-7 text-center">
          <div className="text-6xl mb-4">🎁</div>

          <h1 className="text-2xl font-bold mb-4">
            You've received a Dozentelecom Gift!
          </h1>

          <p className="text-lg mb-4">
            Your{" "}
            <strong>
              {amount}
            </strong>{" "}
            {success.type === "AIRTIME"
              ? "Airtime"
              : "Data"}{" "}
            has been successfully sent to{" "}
            <strong>{success.phone}</strong>.
          </p>

          <p className="text-gray-600 mb-5">
            Want to enjoy more services from
            Dozentelecom?
            <br />
            Register now:
          </p>

          <a
            href="https://dozentelecom.vercel.app/register"
            className="inline-flex w-full justify-center rounded-xl px-5 py-3 font-semibold"
          >
            Register on Dozentelecom
          </a>
        </div>
      </main>
    );
  }

  if (!giveaway?.active) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border p-7 text-center">
          <div className="text-5xl mb-4">🎁</div>

          <h1 className="text-2xl font-bold mb-2">
            Giveaway unavailable
          </h1>

          <p className="text-gray-500">
            This giveaway has ended or all available
            gifts have been claimed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border shadow-lg p-7">
        <div className="text-center mb-7">
          <div className="text-6xl mb-4">🎁</div>

          <h1 className="text-3xl font-bold">
            You've Got a Gift!
          </h1>

          <p className="text-gray-500 mt-2">
            A Dozentelecom customer sent you a gift.
          </p>
        </div>

        <div className="rounded-2xl border p-5 mb-6 text-center">
          <p className="text-sm text-gray-500 mb-1">
            Your Gift
          </p>

          <p className="text-3xl font-bold">
            {giveaway.type === "AIRTIME"
              ? `₦${Number(
                  giveaway.amount || 0
                ).toLocaleString()} Airtime`
              : giveaway.dataPlanName || "Data"}
          </p>

          <p className="text-sm text-gray-500 mt-3">
            {giveaway.remaining} gift
            {giveaway.remaining === 1 ? "" : "s"} remaining
          </p>
        </div>

        <label className="block text-sm font-medium mb-2">
          Phone Number
        </label>

        <input
          type="tel"
          inputMode="numeric"
          maxLength={11}
          placeholder="08012345678"
          value={phone}
          onChange={(e) =>
            setPhone(
              e.target.value
                .replace(/\D/g, "")
                .slice(0, 11)
            )
          }
          className="w-full rounded-xl border px-4 py-3 outline-none"
        />

        {error && (
          <div className="mt-3 rounded-xl p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={claimGift}
          disabled={claiming}
          className="w-full mt-5 rounded-xl px-5 py-3 font-semibold disabled:opacity-50"
        >
          {claiming
            ? "Sending Gift..."
            : "🎁 Claim My Gift"}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          You can claim this giveaway only once with
          the same phone number.
        </p>
      </div>
    </main>
  );
}