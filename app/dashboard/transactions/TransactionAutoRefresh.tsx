"use client";

import { useEffect, useRef } from "react";

export default function TransactionAutoRefresh() {
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkTransactions() {
      if (cancelled || running.current) {
        return;
      }

      running.current = true;

      try {
        const response = await fetch(
          "/api/transactions/reconcile",
          {
            method: "POST",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        console.log(
          "TRANSACTION RECONCILIATION:",
          data
        );

        if (
          !cancelled &&
          Number(data?.updated || 0) > 0
        ) {
          window.location.reload();
        }
      } catch (error) {
        console.error(
          "TRANSACTION RECONCILIATION ERROR:",
          error
        );
      } finally {
        running.current = false;
      }
    }

    checkTransactions();

    const interval = window.setInterval(
      checkTransactions,
      10000
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
            }
