"use client";

import { useEffect, useRef } from "react";

export default function TransactionAutoRefresh() {
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (
        cancelled ||
        running.current
      ) {
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

        const data =
          await response.json().catch(
            () => ({})
          );

        console.log(
          "TRANSACTION RECONCILIATION:",
          data
        );

        /*
         * If any old transaction was changed,
         * reload the page so the new DB status
         * is displayed.
         */

        if (
          !cancelled &&
          Number(data?.updated || 0) > 0
        ) {
          window.location.reload();
          return;
        }
      } catch (error) {
        console.error(
          "TRANSACTION AUTO REFRESH ERROR:",
          error
        );
      } finally {
        running.current = false;
      }
    };

    /*
     * Check immediately when the page opens.
     */
    check();

    /*
     * Then check every 10 seconds.
     */
    const interval =
      window.setInterval(
        check,
        10000
      );

    return () => {
      cancelled = true;

      window.clearInterval(
        interval
      );
    };
  }, []);

  return null;
      }
