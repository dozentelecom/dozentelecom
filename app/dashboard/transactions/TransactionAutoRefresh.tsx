"use client";

import { useEffect, useRef } from "react";

type Props = {
  references: string[];
};

export default function TransactionAutoRefresh({
  references,
}: Props) {
  const running = useRef(false);

  useEffect(() => {
    if (!references.length) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled || running.current) return;

      running.current = true;

      try {
        let shouldReload = false;

        for (const reference of references) {
          if (cancelled) break;

          try {
            const response = await fetch(
              "/api/transactions/status",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  reference,
                }),
                cache: "no-store",
              }
            );

            if (!response.ok) continue;

            const data = await response.json();

            if (
              data?.status === "SUCCESS" ||
              data?.status === "FAILED" ||
              data?.status === "REVERSED"
            ) {
              shouldReload = true;
              break;
            }
          } catch {
            // Ignore temporary network errors.
          }
        }

        if (shouldReload && !cancelled) {
          window.location.reload();
        }
      } finally {
        running.current = false;
      }
    };

    check();

    const interval = window.setInterval(
      check,
      10000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [references]);

  return null;
}