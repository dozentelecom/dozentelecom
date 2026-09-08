"use client";

import { useEffect, useState } from "react";

type Props = {
  registration: ServiceWorkerRegistration | null;
};

export default function UpdatePrompt({
  registration,
}: Props) {
  const [updateAvailable, setUpdateAvailable] =
    useState(false);

  useEffect(() => {
    if (!registration) {
      return;
    }

    const checkForUpdate = () => {
      registration.update().catch(() => {});
    };

    checkForUpdate();

    const interval = window.setInterval(
      checkForUpdate,
      5 * 60 * 1000
    );

    const worker = registration.installing;

    if (worker) {
      const handleStateChange = () => {
        if (
          worker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          setUpdateAvailable(true);
        }
      };

      worker.addEventListener(
        "statechange",
        handleStateChange
      );

      return () => {
        worker.removeEventListener(
          "statechange",
          handleStateChange
        );

        window.clearInterval(interval);
      };
    }

    return () => {
      window.clearInterval(interval);
    };
  }, [registration]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      );
    };
  }, []);

  const updateApp = () => {
    if (!registration?.waiting) {
      window.location.reload();
      return;
    }

    registration.waiting.postMessage({
      type: "SKIP_WAITING",
    });
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="pwa-update-box">
      <div className="pwa-update-content">
        <strong>New version available</strong>

        <span>
          Dozentelecom has been updated.
        </span>

        <button
          type="button"
          onClick={updateApp}
        >
          Update now
        </button>
      </div>
    </div>
  );
}