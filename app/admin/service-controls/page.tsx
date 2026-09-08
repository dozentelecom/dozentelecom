"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ServiceKey =
  | "data"
  | "airtime"
  | "electricity"
  | "cable"
  | "education";

const SERVICE_INFO: Record<
  ServiceKey,
  {
    name: string;
    description: string;
    icon: string;
  }
> = {
  data: {
    name: "Data",
    description:
      "Control mobile data purchases.",
    icon: "📶",
  },

  airtime: {
    name: "Airtime",
    description:
      "Control airtime purchases.",
    icon: "📱",
  },

  electricity: {
    name: "Electricity",
    description:
      "Control electricity bill payments.",
    icon: "⚡",
  },

  cable: {
    name: "Cable TV",
    description:
      "Control cable TV subscriptions.",
    icon: "📺",
  },

  education: {
    name: "Education",
    description:
      "Control exam pins and education products.",
    icon: "🎓",
  },
};

export default function ServiceControlsPage() {
  const [services, setServices] =
    useState<Record<ServiceKey, boolean>>({
      data: true,
      airtime: true,
      electricity: true,
      cable: true,
      education: true,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState<ServiceKey | null>(null);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/service-controls",
        {
          cache: "no-store",
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to load services"
        );
      }

      setServices(result.services);
    } catch (error: any) {
      setError(
        error?.message ||
          "Unable to load services"
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleService(
    service: ServiceKey
  ) {
    const nextValue = !services[service];

    try {
      setSaving(service);
      setError("");

      const response = await fetch(
        "/api/admin/service-controls",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            service,
            enabled: nextValue,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to update service"
        );
      }

      setServices((current) => ({
        ...current,
        [service]: nextValue,
      }));
    } catch (error: any) {
      setError(
        error?.message ||
          "Unable to update service"
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="admin-dashboard-layout">
      <main className="admin-dashboard-content">

        <div className="admin-dashboard-top">
          <div>
            <div className="eyebrow">
              ADMINISTRATION
            </div>

            <h1>
              Service Controls
            </h1>

            <p className="muted">
              Enable or temporarily disable
              customer services.
            </p>
          </div>

          <Link
            href="/admin"
            className="secondary-button"
          >
            Dashboard
          </Link>
        </div>

        {error && (
          <div className="card admin-error-card">
            <p>{error}</p>
          </div>
        )}

        <div className="admin-service-controls-grid">

          {(
            Object.keys(
              SERVICE_INFO
            ) as ServiceKey[]
          ).map((service) => {
            const info =
              SERVICE_INFO[service];

            const enabled =
              services[service];

            const isSaving =
              saving === service;

            return (
              <div
                key={service}
                className="card admin-service-control-card"
              >
                <div className="admin-service-control-icon">
                  {info.icon}
                </div>

                <div className="admin-service-control-content">
                  <h3>
                    {info.name}
                  </h3>

                  <p className="muted">
                    {info.description}
                  </p>

                  <div
                    className={
                      enabled
                        ? "admin-service-status enabled"
                        : "admin-service-status disabled"
                    }
                  >
                    <span>
                      {enabled
                        ? "●"
                        : "●"}
                    </span>

                    {enabled
                      ? "Service Active"
                      : "Service Disabled"}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() =>
                    toggleService(
                      service
                    )
                  }
                  className={
                    enabled
                      ? "admin-service-toggle on"
                      : "admin-service-toggle off"
                  }
                >
                  {isSaving
                    ? "Saving..."
                    : enabled
                    ? "Disable"
                    : "Enable"}
                </button>
              </div>
            );
          })}

        </div>

      </main>
    </div>
  );
}