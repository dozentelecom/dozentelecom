"use client";

import { useEffect, useState } from "react";
import UpdatePrompt from "./UpdatePrompt";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export default function PWAProvider() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    /*
     * Register service worker.
     */
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          setRegistration(reg);

          /*
           * Check for a new version whenever the app loads.
           */
          reg.update().catch(() => {});
        })
        .catch((error) => {
          console.error(
            "Dozentelecom service worker registration failed:",
            error
          );
        });
    }

    /*
     * Android / Chrome installation prompt.
     */
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setInstallPrompt(
        event as BeforeInstallPromptEvent
      );
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  useEffect(() => {
    /*
     * Expose the install prompt globally so
     * FloatingActions can trigger it.
     */
    if (!installPrompt) {
      return;
    }

    (
      window as Window & {
        dozentelecomInstall?: () => Promise<void>;
      }
    ).dozentelecomInstall = async () => {
      await installPrompt.prompt();

      await installPrompt.userChoice;

      setInstallPrompt(null);

      (
        window as Window & {
          dozentelecomInstall?: () => Promise<void>;
        }
      ).dozentelecomInstall = undefined;
    };

    return () => {
      (
        window as Window & {
          dozentelecomInstall?: () => Promise<void>;
        }
      ).dozentelecomInstall = undefined;
    };
  }, [installPrompt]);

  return (
    <UpdatePrompt registration={registration} />
  );
}