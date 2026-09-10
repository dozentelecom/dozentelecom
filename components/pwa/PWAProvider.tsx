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
     * Register service worker
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
     * Chrome / Android native installation event
     */
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const promptEvent =
        event as BeforeInstallPromptEvent;

      console.log(
        "Dozentelecom: native install prompt available"
      );

      setInstallPrompt(promptEvent);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    /*
     * App successfully installed
     */
    const handleAppInstalled = () => {
      console.log(
        "Dozentelecom: app installed"
      );

      setInstallPrompt(null);

      window.dozentelecomInstall = undefined;
      window.dozentelecomCanInstall = () => false;

      window.dispatchEvent(
        new CustomEvent("dozentelecom-install-state", {
          detail: {
            available: false,
            installed: true,
          },
        })
      );
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
   * Expose the current install prompt to the rest
   * of the application.
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!installPrompt) {
      window.dozentelecomInstall = undefined;
      window.dozentelecomCanInstall = () => false;

      window.dispatchEvent(
        new CustomEvent("dozentelecom-install-state", {
          detail: {
            available: false,
          },
        })
      );

      return;
    }

    window.dozentelecomCanInstall = () => true;

    window.dozentelecomInstall = async () => {
      try {
        await installPrompt.prompt();

        const result =
          await installPrompt.userChoice;

        /*
         * beforeinstallprompt can only be used once.
         */
        setInstallPrompt(null);

        window.dozentelecomInstall = undefined;
        window.dozentelecomCanInstall = () => false;

        window.dispatchEvent(
          new CustomEvent("dozentelecom-install-state", {
            detail: {
              available: false,
              installed:
                result?.outcome === "accepted",
            },
          })
        );

        return result?.outcome === "accepted";
      } catch (error) {
        console.error(
          "Dozentelecom installation failed:",
          error
        );

        setInstallPrompt(null);

        window.dozentelecomInstall = undefined;
        window.dozentelecomCanInstall = () => false;

        window.dispatchEvent(
          new CustomEvent("dozentelecom-install-state", {
            detail: {
              available: false,
            },
          })
        );

        return false;
      }
    };

    window.dispatchEvent(
      new CustomEvent("dozentelecom-install-state", {
        detail: {
          available: true,
        },
      })
    );
  }, [installPrompt]);

  return (
    <UpdatePrompt registration={registration} />
  );
}