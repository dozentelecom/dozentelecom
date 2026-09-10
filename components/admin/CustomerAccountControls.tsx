"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  userId: string;
  initiallyBlocked: boolean;
};

export default function CustomerAccountControls({
  userId,
  initiallyBlocked,
}: Props) {
  const router = useRouter();

  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggleBlocked() {
    if (saving) return;

    const nextValue = !blocked;

    const confirmed = window.confirm(
      nextValue
        ? "Are you sure you want to block this customer?"
        : "Are you sure you want to unblock this customer?"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/users/${userId}/block`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            blocked: nextValue,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message || "Failed to update customer status"
        );
      }

      const persistedBlocked =
        data?.customer?.blocked === true;

      setBlocked(persistedBlocked);

      router.refresh();
    } catch (err: any) {
      setError(
        err?.message || "Failed to update customer status"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-medium">
          Account Status
        </div>

        <div
          className={`mt-1 text-sm font-semibold ${
            blocked ? "text-red-600" : "text-green-600"
          }`}
        >
          {blocked ? "Blocked" : "Active"}
        </div>
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={toggleBlocked}
        disabled={saving}
      >
        {saving
          ? "Updating..."
          : blocked
          ? "Unblock Account"
          : "Block Account"}
      </button>

      {error && (
        <p className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}