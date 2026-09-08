"use client";

import { useState } from "react";

export default function FloatingActions() {
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const installApp = async () => {
    const install =
      (
        window as Window & {
          dozentelecomInstall?: () => Promise<void>;
        }
      ).dozentelecomInstall;

    if (install) {
      try {
        await install();
      } catch (error) {
        console.error("Installation failed:", error);
      }

      return;
    }

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

  return (
    <>
      {/* FLOATING ACTIONS */}

      <div className="dt-floating-actions">

        {/* INSTALL APP */}

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


        {/* WHATSAPP */}

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


      {/* INSTALL HELP */}

      {showInstallHelp && (
        <div
          className="dt-install-help-overlay"
          onClick={() => setShowInstallHelp(false)}
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
                <strong>iPhone / iPad:</strong>
              </p>

              <p>
                Tap the
                <strong> Share </strong>
                button in Safari, then select
                <strong> Add to Home Screen</strong>.
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