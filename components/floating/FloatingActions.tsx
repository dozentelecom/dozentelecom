"use client";

import { useState } from "react";

export default function FloatingActions() {
  const [showInstallHelp, setShowInstallHelp] =
    useState(false);

  const [isInstalled, setIsInstalled] =
    useState(false);

  const installApp = () => {
    if (isInstalled) {
      return;
    }

    /*
     * Download the official Dozentelecom Android APK.
     *
     * The APK is hosted by Dozentelecom itself at:
     * /downloads/dozentelecom.apk
     */
    const link = document.createElement("a");

    link.href = "/downloads/dozentelecom.apk";
    link.download = "dozentelecom.apk";
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

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
              The Dozentelecom Android app is
              downloading now.
            </p>

            <div className="dt-install-instructions">
              <p>
                <strong>
                  Android:
                </strong>
              </p>

              <p>
                Open the downloaded
                <strong> dozentelecom.apk </strong>
                file and follow the Android
                installation instructions.
              </p>

              <p>
                If Android asks for permission to
                install apps from this browser,
                allow it and continue the
                installation.
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
