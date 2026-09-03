"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GenerateAccountButton() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function generateAccount() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/paystack/dva",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const text = await response.text();

      let data: any;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          "Invalid response from server"
        );
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to generate account"
        );
      }

      /*
       * Account was returned immediately.
       */
      if (data?.accountNumber) {
        setMessage(
          "Your virtual account has been generated."
        );

        router.refresh();

        setLoading(false);

        return;
      }

      /*
       * Paystack is processing the assignment.
       */
      if (data?.pending) {
        setMessage(
          "Generating your virtual account..."
        );

        /*
         * Check MongoDB every 3 seconds.
         * The Paystack webhook should populate
         * the account details.
         */
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) =>
            setTimeout(resolve, 3000)
          );

          const statusResponse =
            await fetch(
              "/api/paystack/dva/status",
              {
                method: "GET",
                cache: "no-store",
              }
            );

          const statusText =
            await statusResponse.text();

          let statusData: any = {};

          try {
            statusData =
              JSON.parse(statusText);
          } catch {
            continue;
          }

          if (
            statusData?.accountNumber
          ) {
            setMessage(
              "Your virtual account has been generated."
            );

            router.refresh();

            setLoading(false);

            return;
          }

          if (
            statusData?.dvaStatus ===
            "FAILED"
          ) {
            throw new Error(
              "Paystack could not generate your virtual account. Please try again."
            );
          }
        }

        setMessage(
          "Account generation is taking longer than expected. Please refresh the dashboard shortly."
        );

        setLoading(false);

        router.refresh();

        return;
      }

      setMessage(
        data?.message ||
          "Account generation request submitted."
      );

      router.refresh();

      setLoading(false);
    } catch (e: any) {
      setError(
        e?.message ||
          "Unable to generate account"
      );

      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        className="btn primary"
        onClick={generateAccount}
        disabled={loading}
      >
        {loading
          ? "Generating account..."
          : "Generate account number"}
      </button>

      {message && (
        <p
          className="muted"
          style={{
            marginTop: "10px",
            fontSize: "13px",
          }}
        >
          {message}
        </p>
      )}

      {error && (
        <p
          style={{
            marginTop: "10px",
            fontSize: "13px",
            color: "#dc2626",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}