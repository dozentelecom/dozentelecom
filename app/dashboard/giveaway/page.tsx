"use client";

import { useEffect, useMemo, useState } from "react";

type GiveawayType = "AIRTIME" | "DATA";

type DataPlan = {
  id: string;
  name: string;
  price: number;
  network: string;
  networkId: string;
  type: string;
  days: string;
};

type NetworkOption = {
  id: string;
  name: string;
};

export default function GiveawayPage() {
  const [type, setType] =
    useState<GiveawayType>("AIRTIME");

  const [plans, setPlans] =
    useState<DataPlan[]>([]);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [network, setNetwork] = useState("");

  const [serviceType, setServiceType] =
    useState("");

  const [dataPlan, setDataPlan] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [recipientLimit, setRecipientLimit] =
    useState("");

  const [pin, setPin] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [giftLink, setGiftLink] =
    useState("");

  /* =========================================================
     LOAD LIVE SME DATA PLANS
     ========================================================= */

  useEffect(() => {
    loadPlans();
  }, []);

  async function loadPlans() {
    try {
      setLoadingPlans(true);
      setError("");

      const response = await fetch(
        "/api/sme/data-plans",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load services from SME API."
        );
      }

      const rawPlans = Array.isArray(data?.plans)
        ? data.plans
        : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];

      const normalized: DataPlan[] =
        rawPlans
          .map((p: any) => ({
            id: String(
              p?.id ??
                p?.plan_id ??
                p?.data_plan ??
                ""
            ),

            name: String(
              p?.name ??
                p?.plan_name ??
                p?.plan ??
                p?.variation ??
                p?.description ??
                "Data Plan"
            ),

            price: Number(
              p?.price ??
                p?.amount ??
                p?.selling_price ??
                p?.cost ??
                0
            ),

            network: String(
              p?.network_name ??
                p?.network ??
                ""
            ),

            networkId: String(
              p?.network_id ??
                p?.network ??
                ""
            ),

            type: String(
              p?.type ??
                p?.datagroup ??
                p?.service_type ??
                "SME"
            ),

            days: String(
              p?.days ??
                p?.validity ??
                p?.duration ??
                ""
            ),
          }))
          .filter(
            (p: DataPlan) =>
              p.id &&
              p.networkId
          );

      setPlans(normalized);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load SME services."
      );
    } finally {
      setLoadingPlans(false);
    }
  }

  /* =========================================================
     NETWORKS FROM LIVE API
     ========================================================= */

  const networkOptions =
    useMemo<NetworkOption[]>(() => {
      const map = new Map<
        string,
        NetworkOption
      >();

      for (const plan of plans) {
        const id = String(
          plan.networkId || ""
        ).trim();

        const name = String(
          plan.network || ""
        ).trim();

        if (
          id &&
          name &&
          !map.has(id)
        ) {
          map.set(id, {
            id,
            name,
          });
        }
      }

      return Array.from(
        map.values()
      );
    }, [plans]);

  /* =========================================================
     SERVICE TYPES FROM LIVE API
     ========================================================= */

  const serviceTypes =
    useMemo(() => {
      const set = new Set<string>();

      for (const plan of plans) {
        if (
          String(plan.networkId) ===
          String(network)
        ) {
          const value =
            String(plan.type || "").trim();

          if (value) {
            set.add(value);
          }
        }
      }

      return Array.from(set);
    }, [plans, network]);

  /* =========================================================
     FILTERED DATA PLANS
     ========================================================= */

  const filteredPlans =
    useMemo(() => {
      return plans.filter((plan) => {
        const networkMatch =
          String(plan.networkId) ===
          String(network);

        if (!networkMatch) {
          return false;
        }

        if (!serviceType) {
          return true;
        }

        return (
          String(plan.type)
            .toLowerCase() ===
          String(serviceType)
            .toLowerCase()
        );
      });
    }, [
      plans,
      network,
      serviceType,
    ]);

  /* =========================================================
     SELECTED PLAN
     ========================================================= */

  const selectedPlan =
    useMemo(() => {
      return plans.find(
        (plan) =>
          String(plan.id) ===
          String(dataPlan)
      );
    }, [plans, dataPlan]);

  /* =========================================================
     RESET DATA FIELDS WHEN NETWORK CHANGES
     ========================================================= */

  function changeNetwork(
    value: string
  ) {
    setNetwork(value);
    setServiceType("");
    setDataPlan("");
  }

  /* =========================================================
     CHANGE GIVEAWAY TYPE
     ========================================================= */

  function changeType(
    value: GiveawayType
  ) {
    setType(value);

    setNetwork("");
    setServiceType("");
    setDataPlan("");
    setAmount("");

    setError("");
    setMessage("");
  }

  /* =========================================================
     CREATE GIVEAWAY
     ========================================================= */

  async function createGiveaway() {
    try {
      setError("");
      setMessage("");
      setGiftLink("");

      if (!network) {
        setError(
          "Please select a network."
        );
        return;
      }

      if (
        type === "DATA" &&
        !dataPlan
      ) {
        setError(
          "Please select a data plan."
        );
        return;
      }

      if (
        type === "AIRTIME"
      ) {
        const airtimeAmount =
          Number(amount);

        if (
          !Number.isFinite(
            airtimeAmount
          ) ||
          airtimeAmount <= 0
        ) {
          setError(
            "Enter a valid airtime amount."
          );
          return;
        }
      }

      const recipients =
        Number(
          recipientLimit
        );

      if (
        !Number.isInteger(
          recipients
        ) ||
        recipients < 1
      ) {
        setError(
          "Enter a valid number of recipients."
        );
        return;
      }

      if (
        !/^\d{4}$/.test(pin)
      ) {
        setError(
          "Enter your 4-digit transaction PIN."
        );
        return;
      }

      setLoading(true);

      const response =
        await fetch(
          "/api/giveaway/create",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              type,

              network:
                Number(network),

              amount:
                type ===
                "AIRTIME"
                  ? Number(amount)
                  : undefined,

              data_plan:
                type === "DATA"
                  ? Number(dataPlan)
                  : undefined,

              recipientLimit:
                recipients,

              pin,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create giveaway."
        );
      }

      const token =
        data?.giveaway?.token ||
        data?.token;

      if (!token) {
        throw new Error(
          "Giveaway was created but no sharing link was returned."
        );
      }

      const link =
        `${window.location.origin}/gift/${token}`;

      setGiftLink(link);

      setMessage(
        "Giveaway created successfully."
      );

      setPin("");
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to create giveaway."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     COPY LINK
     ========================================================= */

  async function copyLink() {
    if (!giftLink) return;

    try {
      await navigator.clipboard.writeText(
        giftLink
      );

      setMessage(
        "Giveaway link copied to clipboard."
      );
    } catch {
      setError(
        "Unable to copy the link. Please copy it manually."
      );
    }
  }

  /* =========================================================
     FORMAT PRICE
     ========================================================= */

  function money(value: number) {
    return `₦${Number(
      value || 0
    ).toLocaleString()}`;
  }

  /* =========================================================
     UI
     ========================================================= */

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl">

        {/* HEADER */}

        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <span>🎁</span>
            DOZENTELECOM GIVEAWAY
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Create a Giveaway
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 md:text-base">
            Create one secure sharing link and
            send Airtime or Data to multiple
            recipients. Each phone number can
            claim the giveaway only once.
          </p>
        </div>

        {/* MAIN CARD */}

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* CARD HEADER */}

          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white md:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                🎁
              </div>

              <div>
                <h2 className="text-lg font-semibold">
                  Giveaway Details
                </h2>

                <p className="mt-1 text-sm text-slate-300">
                  Choose what you want to give and
                  configure your recipients.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">

            {/* GIVEAWAY TYPE */}

            <div className="mb-8">
              <label className="mb-3 block text-sm font-semibold text-slate-800">
                What would you like to give?
              </label>

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    changeType(
                      "AIRTIME"
                    )
                  }
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    type === "AIRTIME"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="mb-2 text-2xl">
                    📱
                  </div>

                  <div className="font-semibold text-slate-900">
                    Airtime
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Send airtime directly to
                    recipients.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    changeType(
                      "DATA"
                    )
                  }
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    type === "DATA"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="mb-2 text-2xl">
                    📶
                  </div>

                  <div className="font-semibold text-slate-900">
                    Data
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Send a live SMEAPI data
                    plan.
                  </div>
                </button>

              </div>
            </div>

            {/* NETWORK */}

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Network
              </label>

              <select
                value={network}
                onChange={(e) =>
                  changeNetwork(
                    e.target.value
                  )
                }
                disabled={
                  loadingPlans
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
              >
                <option value="">
                  {loadingPlans
                    ? "Loading networks..."
                    : "Select network"}
                </option>

                {networkOptions.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>

              <p className="mt-2 text-xs text-slate-400">
                Networks are loaded automatically
                from the live SMEAPI catalogue.
              </p>
            </div>

            {/* DATA */}

            {type === "DATA" && (
              <>
                {/* SERVICE TYPE */}

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Service Type
                  </label>

                  <select
                    value={
                      serviceType
                    }
                    onChange={(e) => {
                      setServiceType(
                        e.target.value
                      );
                      setDataPlan("");
                    }}
                    disabled={
                      !network ||
                      loadingPlans
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                  >
                    <option value="">
                      {!network
                        ? "Select a network first"
                        : "Select service type"}
                    </option>

                    {serviceTypes.map(
                      (service) => (
                        <option
                          key={service}
                          value={service}
                        >
                          {service}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* DATA PLAN */}

                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold text-slate-800">
                    Data Plan
                  </label>

                  <select
                    value={dataPlan}
                    onChange={(e) =>
                      setDataPlan(
                        e.target.value
                      )
                    }
                    disabled={
                      !network ||
                      !serviceType ||
                      loadingPlans
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:bg-slate-50"
                  >
                    <option value="">
                      {!network
                        ? "Select a network first"
                        : !serviceType
                        ? "Select service type first"
                        : loadingPlans
                        ? "Loading plans..."
                        : filteredPlans.length ===
                          0
                        ? "No plans available"
                        : "Select data plan"}
                    </option>

                    {filteredPlans.map(
                      (plan) => (
                        <option
                          key={plan.id}
                          value={plan.id}
                        >
                          {plan.name}
                          {plan.days
                            ? ` • ${plan.days}`
                            : ""}{" "}
                          —{" "}
                          {money(
                            plan.price
                          )}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SELECTED PLAN SUMMARY */}

                {selectedPlan && (
                  <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Selected Plan
                      </span>

                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        SMEAPI
                      </span>
                    </div>

                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {selectedPlan.name}
                        </p>

                        {selectedPlan.days && (
                          <p className="mt-1 text-xs text-slate-500">
                            Validity:{" "}
                            {
                              selectedPlan.days
                            }
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          Provider price
                        </p>

                        <p className="text-xl font-bold text-slate-900">
                          {money(
                            selectedPlan.price
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* AIRTIME */}

            {type === "AIRTIME" && (
              <div className="mb-6">
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Airtime Amount
                </label>

                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    ₦
                  </span>

                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="100"
                    value={amount}
                    onChange={(e) =>
                      setAmount(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  Airtime amounts are processed
                  using your configured SMEAPI
                  airtime settings.
                </p>
              </div>
            )}

            {/* RECIPIENT COUNT */}

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Number of Recipients
              </label>

              <input
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="10"
                value={
                  recipientLimit
                }
                onChange={(e) =>
                  setRecipientLimit(
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

              <p className="mt-2 text-xs text-slate-400">
                Each recipient can successfully
                claim this giveaway only once.
              </p>
            </div>

            {/* GIVEAWAY SUMMARY */}

            {(selectedPlan ||
              (type === "AIRTIME" &&
                Number(amount) > 0)) &&
              Number(
                recipientLimit
              ) > 0 && (
                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-lg">
                      📋
                    </span>

                    <h3 className="font-semibold text-slate-900">
                      Giveaway Summary
                    </h3>
                  </div>

                  <div className="space-y-3 text-sm">

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Gift type
                      </span>

                      <span className="font-medium text-slate-900">
                        {type ===
                        "AIRTIME"
                          ? "Airtime"
                          : "Data"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">
                        Network
                      </span>

                      <span className="font-medium text-slate-900">
                        {networkOptions.find(
                          (n) =>
                            n.id ===
                            network
                        )?.name ||
                          "—"}
                      </span>
                    </div>

                    {selectedPlan && (
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Data plan
                        </span>

                        <span className="max-w-[60%] text-right font-medium text-slate-900">
                          {
                            selectedPlan.name
                          }
                        </span>
                      </div>
                    )}

                    {type ===
                      "AIRTIME" && (
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Gift per recipient
                        </span>

                        <span className="font-semibold text-slate-900">
                          {money(
                            Number(
                              amount
                            )
                          )}
                        </span>
                      </div>
                    )}

                    {selectedPlan && (
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">
                          Provider price
                        </span>

                        <span className="font-semibold text-slate-900">
                          {money(
                            selectedPlan.price
                          )}
                        </span>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-3">
                      <div className="flex justify-between gap-4">
                        <span className="font-medium text-slate-700">
                          Recipients
                        </span>

                        <span className="font-bold text-slate-900">
                          {
                            recipientLimit
                          }
                        </span>
                      </div>
                    </div>

                  </div>

                  <div className="mt-4 rounded-xl bg-white p-3 text-xs leading-5 text-slate-500">
                    Your wallet is charged when a
                    recipient successfully claims a
                    gift. The final customer price is
                    calculated by your server-side
                    giveaway pricing rules.
                  </div>
                </div>
              )}

            {/* PIN */}

            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Transaction PIN
              </label>

              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) =>
                  setPin(
                    e.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        4
                      )
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-center text-lg tracking-[0.5em] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />

              <p className="mt-2 text-xs text-slate-400">
                Your PIN is used only to authorize
                the giveaway creation.
              </p>
            </div>

            {/* ERROR */}

            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <span className="text-lg">
                  ⚠️
                </span>

                <p>{error}</p>
              </div>
            )}

            {/* SUCCESS */}

            {message && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
                <span className="text-lg">
                  ✓
                </span>

                <p>{message}</p>
              </div>
            )}

            {/* CREATE BUTTON */}

            <button
              type="button"
              onClick={
                createGiveaway
              }
              disabled={
                loading ||
                loadingPlans
              }
              className="w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating Giveaway...
                </span>
              ) : (
                "🎁 Create Giveaway"
              )}
            </button>

          </div>
        </div>

        {/* GENERATED LINK */}

        {giftLink && (
          <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">

            <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-xl">
                  ✓
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Giveaway Ready
                  </h2>

                  <p className="text-sm text-slate-500">
                    Your sharing link has been
                    created successfully.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Giveaway Link
              </label>

              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="break-all text-sm font-medium text-slate-700">
                  {giftLink}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  copyLink
                }
                className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                📋 Copy Giveaway Link
              </button>

              <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  How it works
                </p>

                <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                  <li>
                    • Share this link with your
                    recipients.
                  </li>

                  <li>
                    • They open the link and enter
                    their Nigerian phone number.
                  </li>

                  <li>
                    • Each phone number can claim
                    only once.
                  </li>

                  <li>
                    • The gift is delivered through
                    SMEAPI after successful
                    validation.
                  </li>
                </ul>
              </div>

            </div>
          </div>
        )}

        {/* SECURITY NOTE */}

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-lg">
            🔒
          </span>

          <div>
            <p className="text-sm font-semibold text-slate-800">
              Secure Giveaway
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Giveaway claims are validated on the
              server. A phone number cannot claim
              the same giveaway more than once.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}