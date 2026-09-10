"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    dozentelecomInstall?: () => Promise<boolean>;
    dozentelecomCanInstall?: () => boolean;
  }
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
     * Detect whether Dozentelecom is already
     * running as an installed standalone app.
     */
    const standalone =
      window.matchMedia?.(
        "(display-mode: standalone)"
      ).matches ||
      (window.navigator as any).standalone === true;

    setIsInstalled(standalone);

    /*
     * Check whether the PWA native install prompt
     * is currently available.
     */
    const checkInstallAvailability = () => {
      setIsInstallAvailable(
        typeof window.dozentelecomCanInstall ===
          "function" &&
          window.dozentelecomCanInstall() === true
      );
    };

    checkInstallAvailability();

    /*
     * The provider can load before or after this
     * component. Check again shortly after mount.
     */
    const timer = window.setTimeout(
      checkInstallAvailability,
      500
    );

    /*
     * Listen for installation.
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

    return () => {
      window.clearTimeout(timer);

      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);

  const installApp = async () => {
    /*
     * If already installed, don't attempt another
     * installation.
     */
    if (isInstalled) {
      return;
    }

    const install =
      window.dozentelecomInstall;

    /*
     * Native browser installation prompt.
     */
    if (install) {
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
     * beforeinstallprompt is unavailable.
     *
     * This is normal on iPhone/iPad Safari and
     * some browsers.
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

  /*
   * Don't show the install button when the site
   * is already running as an installed app.
   */
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
                If your browser supports app
                installation, tap the install
                button again and the browser will
                show the native installation prompt.
              </p>

              <p>
                <strong>
                  iPhone / iPad:
                </strong>
              </p>

              <p>
                Tap the{" "}
                <strong>Share</strong>{" "}
                button in Safari, then select{" "}
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