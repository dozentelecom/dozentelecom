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

declare global {
  interface Window {
    dozentelecomInstall?: () => Promise<boolean>;
    dozentelecomCanInstall?: () => boolean;
  }
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
     * Capture the browser's native PWA
     * installation event.
     *
     * Supported mainly by Chromium browsers
     * such as Chrome and Edge.
     */
    const handleBeforeInstallPrompt = (
      event: Event
    ) => {
      event.preventDefault();

      const promptEvent =
        event as BeforeInstallPromptEvent;

      setInstallPrompt(promptEvent);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    /*
     * If the app becomes installed, remove
     * the saved installation prompt.
     */
    const handleAppInstalled = () => {
      setInstallPrompt(null);

      window.dozentelecomInstall = undefined;
      window.dozentelecomCanInstall = () => false;
    };

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  /*
   * Keep the native installation function
   * available to FloatingActions.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!installPrompt) {
      window.dozentelecomInstall = undefined;
      window.dozentelecomCanInstall = () => false;
      return;
    }

    window.dozentelecomCanInstall = () => true;

    window.dozentelecomInstall = async () => {
      try {
        await installPrompt.prompt();

        const result =
          await installPrompt.userChoice;

        /*
         * The browser only allows a captured
         * beforeinstallprompt event to be used once.
         */
        setInstallPrompt(null);

        window.dozentelecomInstall = undefined;
        window.dozentelecomCanInstall = () => false;

        return result?.outcome === "accepted";
      } catch (error) {
        console.error(
          "Dozentelecom installation failed:",
          error
        );

        setInstallPrompt(null);

        window.dozentelecomInstall = undefined;
        window.dozentelecomCanInstall = () => false;

        return false;
      }
    };

    return () => {
      window.dozentelecomInstall = undefined;
      window.dozentelecomCanInstall = () => false;
    };
  }, [installPrompt]);

  return (
    <UpdatePrompt registration={registration} />
  );
}