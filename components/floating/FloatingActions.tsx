"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    dozentelecomInstall?: () => Promise<boolean>;
    dozentelecomCanInstall?: () => boolean;
  }
}

interface InstallStateEvent extends CustomEvent {
  detail?: {
    available?: boolean;
    installed?: boolean;
  };
}

export default function FloatingActions() {
  const [showInstallHelp, setShowInstallHelp] =
    useState(false);

  const [isInstallAvailable, setIsInstallAvailable] =
    useState(false);

  const [isInstalled, setIsInstalled] =
    useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    /*
     * Check whether the website is already running
     * as an installed PWA.
     */
    const checkStandalone = () => {
      const standalone =
        window.matchMedia?.(
          "(display-mode: standalone)"
        ).matches ||
        (window.navigator as any).standalone === true;

      setIsInstalled(standalone);

      if (standalone) {
        setIsInstallAvailable(false);
      }
    };

    checkStandalone();

    /*
     * Receive install-state changes from PWAProvider.
     *
     * This is important because beforeinstallprompt
     * may fire after this component has already mounted.
     */
    const handleInstallState = (
      event: Event
    ) => {
      const customEvent =
        event as InstallStateEvent;

      const available =
        customEvent.detail?.available === true;

      const installed =
        customEvent.detail?.installed === true;

      if (installed) {
        setIsInstalled(true);
        setIsInstallAvailable(false);
        setShowInstallHelp(false);
        return;
      }

      if (!isInstalled) {
        setIsInstallAvailable(available);
      }
    };

    window.addEventListener(
      "dozentelecom-install-state",
      handleInstallState
    );

    /*
     * App installed event.
     */
    const handleInstalled = () => {
      setIsInstalled(true);
      setIsInstallAvailable(false);
      setShowInstallHelp(false);
    };

    window.addEventListener(
      "appinstalled",
      handleInstalled
    );

    /*
     * The provider may already have captured the
     * install prompt before this component mounted.
     */
    const checkExistingPrompt = () => {
      if (
        typeof window.dozentelecomCanInstall ===
          "function" &&
        window.dozentelecomCanInstall()
      ) {
        setIsInstallAvailable(true);
      }
    };

    checkExistingPrompt();

    const timer = window.setTimeout(
      checkExistingPrompt,
      1000
    );

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener(
        "dozentelecom-install-state",
        handleInstallState
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, [isInstalled]);

  const installApp = async () => {
    if (isInstalled) {
      return;
    }

    /*
     * Native Chrome installation prompt.
     */
    const install =
      window.dozentelecomInstall;

    if (
      typeof install === "function"
    ) {
      try {
        const accepted = await install();

        if (accepted) {
          setIsInstalled(true);
          setIsInstallAvailable(false);
          setShowInstallHelp(false);
        }

        return;
      } catch (error) {
        console.error(
          "Dozentelecom installation failed:",
          error
        );
      }
    }

    /*
     * No native prompt is currently available.
     *
     * This normally happens on:
     * - iPhone/iPad
     * - unsupported browsers
     * - browsers where PWA install criteria
     *   have not yet been satisfied
     */
    setShowInstallHelp(true);
  };

  const whatsappNumber =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "";

  const whatsappMessage = encodeURIComponent(
    "Hello Dozentelecom Support, I need assistance."
  );

  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`
    : "";

  const openSupport = () => {
    if (!whatsappNumber) {
      alert(
        "WhatsApp support number has not been configured yet."
      );

      return;
    }

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const showInstallButton = !isInstalled;

  return (
    <>
      <div className="dt-floating-actions">
        {showInstallButton && (
          <button
            type="button"
            className="dt-floating-button dt-install-button"
            onClick={installApp}
            aria-label="Install Dozentelecom app"
            title="Install Dozentelecom"
          >
            <span className="dt-floating-icon">
              ⇩
            </span>
          </button>
        )}

        <button
          type="button"
          className="dt-floating-button dt-support-button"
          onClick={openSupport}
          aria-label="Contact Dozentelecom Support"
          title="WhatsApp Support"
        >
          <span className="dt-floating-icon">
            ☎
          </span>
        </button>
      </div>

      {showInstallHelp && (
        <div
          className="dt-install-help-overlay"
          onClick={() =>
            setShowInstallHelp(false)
          }
        >
          <div
            className="dt-install-help"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <button
              type="button"
              className="dt-install-help-close"
              onClick={() =>
                setShowInstallHelp(false)
              }
              aria-label="Close"
            >
              ×
            </button>

            <div className="dt-install-logo">
              <img
                src="/icons/icon-192.png"
                alt="Dozentelecom"
              />
            </div>

            <h3>
              Install Dozentelecom
            </h3>

            <p>
              Install Dozentelecom on your device
              for quick access like a normal app.
            </p>

            <div className="dt-install-instructions">
              <p>
                <strong>
                  Android / Chrome:
                </strong>
              </p>

              <p>
                If Chrome supports installation,
                the Install button will open the
                native installation prompt.
              </p>

              <p>
                <strong>
                  iPhone / iPad:
                </strong>
              </p>

              <p>
                Open Dozentelecom in Safari, tap
                the <strong>Share</strong> button,
                then select{" "}
                <strong>
                  Add to Home Screen
                </strong>.
              </p>
            </div>

            <button
              type="button"
              className="dt-install-help-button"
              onClick={() =>
                setShowInstallHelp(false)
              }
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}