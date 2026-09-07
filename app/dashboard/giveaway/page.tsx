"use client";

import { useEffect, useMemo, useState } from "react";

type GiftType = "AIRTIME" | "DATA";

type DataPlan = {
  id: string;
  name: string;
  price: number;
  network: string;
  networkId: string;
  type: string;
  days: string;
};

function percentPrice(cost: number, rate: number) {
  return Math.ceil(cost * (1 + rate / 100) * 100) / 100;
}

function money(value: number) {
  const amount = Number(value || 0);

  return `₦${amount.toLocaleString("en-NG", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function GiveawayPage() {
  const [type, setType] = useState<GiftType>("AIRTIME");

  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  const [dataMarkup, setDataMarkup] = useState(0);
  const [airtimeRoundUnit, setAirtimeRoundUnit] = useState(10);

  const [network, setNetwork] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [dataPlan, setDataPlan] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientLimit, setRecipientLimit] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [giftLink, setGiftLink] = useState("");

  /*
   * =========================================================
   * LOAD DATA
   * =========================================================
   */

  useEffect(() => {
    loadPlans();
    loadPricing();
  }, []);

  /*
   * =========================================================
   * LOAD SME DATA PLANS
   * =========================================================
   */

  async function loadPlans() {
    try {
      setLoadingPlans(true);
      setError("");

      const response = await fetch("/api/sme/data-plans", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load data plans"
        );
      }

      const rawPlans = Array.isArray(data)
        ? data
        : Array.isArray(data?.plans)
        ? data.plans
        : Array.isArray(data?.data)
        ? data.data
        : [];

      const normalized: DataPlan[] = rawPlans
        .map((p: any, index: number) => ({
          id: String(
            p?.id ??
              p?.plan_id ??
              p?.data_plan ??
              index
          ),

          name: String(
            p?.name ??
              p?.plan_name ??
              p?.data_plan ??
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
            p?.network ??
              p?.network_name ??
              p?.network_id ??
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
            Number.isFinite(p.price) &&
            p.price > 0
        );

      setPlans(normalized);
    } catch (err: any) {
      setError(
        err?.message || "Unable to load data plans"
      );
    } finally {
      setLoadingPlans(false);
    }
  }

  /*
   * =========================================================
   * LOAD ADMIN PRICING
   * =========================================================
   */

  async function loadPricing() {
    try {
      const response = await fetch(
        "/api/giveaway/pricing",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load pricing"
        );
      }

      const pricing = data?.pricing || {};

      setDataMarkup(
        Number(pricing?.dataMarkup ?? 0)
      );

      setAirtimeRoundUnit(
        Math.max(
          1,
          Number(
            pricing?.airtimeRoundUnit ?? 10
          )
        )
      );
    } catch (err) {
      console.error(
        "Giveaway pricing error:",
        err
      );
    }
  }

  /*
   * =========================================================
   * NETWORK OPTIONS
   * =========================================================
   */

  const networkOptions = useMemo(() => {
    const map = new Map<string, string>();

    for (const plan of plans) {
      const id =
        plan.networkId ||
        plan.network;

      if (!id) continue;

      const name =
        plan.network &&
        !/^\d+$/.test(plan.network)
          ? plan.network
          : id === "1"
          ? "MTN"
          : id === "2"
          ? "Airtel"
          : id === "3"
          ? "GLO"
          : id === "4"
          ? "9mobile"
          : `Network ${id}`;

      map.set(id, name);
    }

    return Array.from(map.entries()).map(
      ([id, name]) => ({
        id,
        name,
      })
    );
  }, [plans]);

  /*
   * =========================================================
   * SERVICE TYPES
   * =========================================================
   */

  const serviceTypes = useMemo(() => {
    if (!network) return [];

    const values = new Set<string>();

    plans
      .filter(
        (p: DataPlan) =>
          p.networkId === network ||
          p.network === network
      )
      .forEach((p: DataPlan) => {
        if (p.type) {
          values.add(p.type);
        }
      });

    return Array.from(values);
  }, [plans, network]);

  /*
   * =========================================================
   * FILTERED DATA PLANS
   * =========================================================
   */

  const filteredPlans = useMemo(() => {
    return plans.filter((p: DataPlan) => {
      const networkMatch =
        !network ||
        p.networkId === network ||
        p.network === network;

      const typeMatch =
        !serviceType ||
        p.type === serviceType;

      return networkMatch && typeMatch;
    });
  }, [plans, network, serviceType]);

  /*
   * =========================================================
   * SELECTED DATA PLAN
   * =========================================================
   */

  const selectedPlan = useMemo(() => {
    return plans.find(
      (p: DataPlan) =>
        p.id === dataPlan
    );
  }, [plans, dataPlan]);

  /*
   * =========================================================
   * DATA CUSTOMER PRICE
   * =========================================================
   */

  const providerDataPrice = Number(selectedPlan?.price || 0);

const selectedDataPrice =
  providerDataPrice > 0
    ? percentPrice(providerDataPrice, Number(dataMarkup || 0))
    : 0;

const dataProfitPerRecipient = Math.max(
  0,
  selectedDataPrice - providerDataPrice
);

const dataTotalProfit =
  dataProfitPerRecipient *
  Number(recipientLimit || 0);

  /*
   * =========================================================
   * AIRTIME PRICE
   * =========================================================
   */

  const airtimePrice = useMemo(() => {
    const value = Number(amount);

    if (
      !Number.isFinite(value) ||
      value <= 0
    ) {
      return 0;
    }

    return (
      Math.ceil(
        value / airtimeRoundUnit
      ) * airtimeRoundUnit
    );
  }, [amount, airtimeRoundUnit]);

  /*
   * =========================================================
   * CREATE GIVEAWAY
   * =========================================================
   */

  async function createGiveaway() {
    try {
      setError("");
      setMessage("");
      setGiftLink("");

      if (!network) {
        setError("Select a network.");
        return;
      }

      if (
        type === "AIRTIME" &&
        (!amount ||
          Number(amount) <= 0)
      ) {
        setError(
          "Enter a valid airtime amount."
        );
        return;
      }

      if (
        type === "DATA" &&
        !dataPlan
      ) {
        setError(
          "Select a data plan."
        );
        return;
      }

      if (
        !recipientLimit ||
        Number(recipientLimit) < 1
      ) {
        setError(
          "Enter the number of recipients."
        );
        return;
      }

      if (
        Number(recipientLimit) > 10000
      ) {
        setError(
          "Recipient count cannot exceed 10,000."
        );
        return;
      }

      if (!/^\d{4}$/.test(pin)) {
        setError("Enter your PIN.");
        return;
      }

      setLoading(true);

      const response = await fetch(
        "/api/giveaway/create",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            type,

            network: Number(network),

            amount:
              type === "AIRTIME"
                ? Number(amount)
                : undefined,

            data_plan:
              type === "DATA"
                ? Number(dataPlan)
                : undefined,

            recipientLimit:
              Number(recipientLimit),

            pin,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to create giveaway"
        );
      }

      const token =
        data?.giveaway?.token ||
        data?.token;

      if (!token) {
        throw new Error(
          "Giveaway was created but no gift link was returned."
        );
      }

      const link =
        `${window.location.origin}/gift/${token}`;

      setGiftLink(link);

      setMessage(
        "🎉 Giveaway created successfully!"
      );

      setPin("");
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to create giveaway"
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =========================================================
   * COPY LINK
   * =========================================================
   */

  async function copyLink() {
    if (!giftLink) return;

    try {
      await navigator.clipboard.writeText(
        giftLink
      );

      setMessage(
        "Giveaway link copied!"
      );
    } catch {
      setError(
        "Unable to copy the giveaway link."
      );
    }
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 md:px-8 md:py-10">
      <div className="mx-auto w-full max-w-4xl">

        {/* =====================================================
            HEADER
            ===================================================== */}

        <div className="mb-7 flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl shadow-lg">
            🎁
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Create Giveaway
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-400">
              Send Airtime or Data to multiple
              recipients through one secure
              giveaway link.
            </p>
          </div>
        </div>

        {/* =====================================================
            MAIN FORM CARD
            ===================================================== */}

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl">

          <div className="p-5 sm:p-7 md:p-8">

<div className="grid grid-cols-2 gap-3 sm:gap-4">

                            {/* AIRTIME */}

                <button
                  type="button"
                  onClick={() => {
                    setType("AIRTIME");
                    setDataPlan("");
                    setServiceType("");
                  }}
                  className={`min-w-0 rounded-2xl border p-3 text-left transition-all duration-200 sm:p-5 ${
                    type === "AIRTIME"
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-slate-700 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg sm:h-11 sm:w-11 sm:text-xl ${
                        type === "AIRTIME"
                          ? "bg-blue-500/15"
                          : "bg-slate-800"
                      }`}
                    >
                      📱
                    </div>

                    {type === "AIRTIME" && (
                      <span className="hidden rounded-full bg-blue-500/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-blue-400 sm:inline-flex">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="mt-3 sm:mt-4">
                    <div className="truncate text-sm font-semibold text-white sm:text-base">
                      Airtime
                    </div>

                    <div className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
      
                    </div>
                  </div>
                </button>

                {/* DATA */}

                <button
                  type="button"
                  onClick={() => {
                    setType("DATA");
                    setAmount("");
                  }}
                  className={`min-w-0 rounded-2xl border p-3 text-left transition-all duration-200 sm:p-5 ${
                    type === "DATA"
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                      : "border-slate-700 bg-slate-950/50 hover:border-slate-600 hover:bg-slate-800/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg sm:h-11 sm:w-11 sm:text-xl ${
                        type === "DATA"
                          ? "bg-blue-500/15"
                          : "bg-slate-800"
                      }`}
                    >
                      🌐
                    </div>

                    {type === "DATA" && (
                      <span className="hidden rounded-full bg-blue-500/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-blue-400 sm:inline-flex">
                        Selected
                      </span>
                    )}
                  </div>

                  <div className="mt-3 sm:mt-4">
                    <div className="truncate text-sm font-semibold text-white sm:text-base">
                      Data
                    </div>

                    <div className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-xs">
                     
                    </div>
                  </div>
                </button>

            </div>

            {/* =================================================
                NETWORK
                ================================================= */}

            <div className="mb-7">
              <label className="mb-2 block text-sm font-semibold text-slate-200">
                Network
              </label>

              <div className="relative">
                <select
                  value={network}
                  onChange={(e) => {
                    setNetwork(e.target.value);
                    setDataPlan("");
                    setServiceType("");
                  }}
                  className="h-12 w-full appearance-none rounded-xl border border-slate-700 bg-slate-950 px-4 pr-10 text-sm font-medium text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                >
                  <option
                    value=""
                    className="bg-slate-900"
                  >
                    Select network
                  </option>

                  {networkOptions.map(
                    (item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        className="bg-slate-900"
                      >
                        {item.name}
                      </option>
                    )
                  )}
                </select>

                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                  ▼
                </span>
              </div>
            </div>

            {/* =================================================
                GIVEAWAY FORM
                ================================================= */}

            <div className="mb-7 rounded-2xl bg-[#0b1329] p-5 text-white shadow-xl sm:p-6">

              <div className="space-y-5">

                {/* =================================================
                    AIRTIME
                    ================================================= */}

                {type === "AIRTIME" && (
                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-100">
                      Airtime Amount (₦)
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                        ₦
                      </span>

                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={amount}
                        onChange={(e) =>
                          setAmount(
                            e.target.value
                          )
                        }
                        className="h-[52px] w-full rounded-xl border-none bg-[#eef2ff] pl-10 pr-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <p className="mt-1.5 text-xs leading-5 text-slate-400">
                      
                    </p>

                    {airtimePrice > 0 && (
                      <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">

                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-400">
                              Amount per recipient
                            </p>

                            <p className="mt-1 text-lg font-bold text-white">
                              {money(
                                airtimePrice
                              )}
                            </p>
                          </div>

                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg">
                            💰
                          </div>
                        </div>

                        {airtimePrice !==
                          Number(amount) && (
                          <p className="mt-2 border-t border-blue-500/10 pt-2 text-xs leading-5 text-slate-400">
                            Rounded using your
                            configured airtime
                            unit of{" "}
                            <span className="font-semibold text-slate-300">
                              {money(
                                airtimeRoundUnit
                              )}
                            </span>
                            .
                          </p>
                        )}

                      </div>
                    )}
                  </div>
                )}

                {/* =================================================
                    DATA
                    ================================================= */}

                {type === "DATA" && (
                  <>
                    {/* DATA SERVICE */}

                    {serviceTypes.length >
                      0 && (
                      <div>
                        <label className="mb-2 block text-sm font-bold text-slate-100">
                          Data Service
                        </label>

                        <div className="relative">
                          <select
                            value={
                              serviceType
                            }
                            onChange={(e) => {
                              setServiceType(
                                e.target.value
                              );
                              setDataPlan(
                                ""
                              );
                            }}
                            className="h-[52px] w-full appearance-none rounded-xl border-none bg-[#eef2ff] px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">
                              All available
                              services
                            </option>

                            {serviceTypes.map(
                              (service) => (
                                <option
                                  key={
                                    service
                                  }
                                  value={
                                    service
                                  }
                                >
                                  {service}
                                </option>
                              )
                            )}
                          </select>

                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                            ▼
                          </span>
                        </div>
                      </div>
                    )}

                    {/* DATA PLAN */}

                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-100">
                        Data Plan
                      </label>

                      <div className="relative">
                        <select
                          value={
                            dataPlan
                          }
                          disabled={
                            loadingPlans ||
                            !network
                          }
                          onChange={(e) =>
                            setDataPlan(
                              e.target.value
                            )
                          }
                          className="h-[52px] w-full appearance-none rounded-xl border-none bg-[#eef2ff] px-4 pr-10 text-sm font-semibold text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">
                            {loadingPlans
                              ? "Loading data plans..."
                              : !network
                              ? "Select a network first"
                              : "Select a data plan"}
                          </option>

                          {filteredPlans.map(
                            (plan) => (
                              <option
                                key={
                                  plan.id
                                }
                                value={
                                  plan.id
                                }
                              >
                                {plan.name}
                                {" — "}
                                {money(
                                  percentPrice(
                                    plan.price,
                                    dataMarkup
                                  )
                                )}
                              </option>
                            )
                          )}
                        </select>

                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                          ▼
                        </span>
                      </div>

                      {loadingPlans &&
                        network && (
                          <p className="mt-2 text-xs text-blue-400">
                            Loading available
                            plans...
                          </p>
                        )}
                    </div>

                    {/* SELECTED DATA PLAN */}

                    {selectedPlan && (
                      <div className="overflow-hidden rounded-xl border border-blue-500/20 bg-blue-500/10">

                        <div className="border-b border-blue-500/10 px-4 py-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Selected Gift
                          </p>

                          <p className="mt-1 text-base font-bold text-white">
                            {
                              selectedPlan.name
                            }
                          </p>
                        </div>

                        <div className="grid grid-cols-1 divide-y divide-blue-500/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">

                          {/* PROVIDER PRICE */}

                          <div className="p-4">
                            <p className="text-xs text-slate-400">
                              Provider price
                            </p>

                            <p className="mt-1 text-base font-semibold text-slate-200">
                              {money(
                                selectedPlan.price
                              )}
                            </p>
                          </div>

                          {/* GIVEAWAY PRICE */}

                          <div className="p-4">
                            <p className="text-xs text-slate-400">
                              Giveaway price
                            </p>

                            <p className="mt-1 text-base font-bold text-blue-400">
                              {money(
                                selectedDataPrice
                              )}
                            </p>
                          </div>

                          {/* PROFIT */}

                          <div className="p-4">
                            <p className="text-xs text-slate-400">
                              Profit per recipient
                            </p>

                            <p className="mt-1 text-base font-bold text-emerald-400">
                              {money(dataProfitPerRecipient)}
                            </p>
                          </div>
                        </div>

                        {/* TOTAL PROFIT */}

                        {Number(
                          recipientLimit
                        ) > 0 && (
                          <div className="border-t border-blue-500/10 bg-emerald-500/5 px-4 py-3">
                            <div className="flex items-center justify-between gap-4">

                              <div>
                                <p className="text-xs font-medium text-slate-400">
                                  Estimated total profit
                                </p>

                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  Based on{" "}
                                  {
                                    recipientLimit
                                  }{" "}
                                  recipient
                                  {Number(
                                    recipientLimit
                                  ) === 1
                                    ? ""
                                    : "s"}
                                  .
                                </p>
                              </div>

                              <p className="text-lg font-bold text-emerald-400">
                               {money(dataTotalProfit)}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* MARKUP NOTE */}

                        {dataMarkup > 0 && (
                          <div className="border-t border-blue-500/10 px-4 py-3 text-xs text-slate-400">
                            Includes your configured{" "}
                            <span className="font-semibold text-slate-300">
                              {dataMarkup}%
                            </span>{" "}
                            Data markup.
                          </div>
                        )}

                      </div>
                    )}
                  </>
                )}

                {/* =================================================
                    NUMBER OF RECIPIENTS
                    ================================================= */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-100">
                    Number of Recipients
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="10000"
                    placeholder="10"
                    value={
                      recipientLimit
                    }
                    onChange={(e) =>
                      setRecipientLimit(
                        e.target.value
                      )
                    }
                    className="h-[52px] w-full rounded-xl border-none bg-[#eef2ff] px-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />

                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                    Each phone number can claim
                    this giveaway only once.
                  </p>
                </div>

                {/* =================================================
                    TRANSACTION PIN
                    ================================================= */}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-100">
                   Transaction PIN
                  </label>

                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
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
                    className="h-[52px] w-full rounded-xl border-none bg-[#eef2ff] px-4 text-base font-semibold tracking-[0.45em] text-slate-900 outline-none transition placeholder:text-slate-400 placeholder:tracking-[0.3em] focus:bg-white focus:ring-2 focus:ring-blue-500"
                  />

                  <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  </p>
                </div>

                {/* =================================================
                    SUMMARY
                    ================================================= */}

                {(type === "AIRTIME"
                  ? airtimePrice > 0
                  : !!selectedPlan) && (
                  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">

                    <div className="mb-4">
                      <p className="text-sm font-bold text-white">
                        Giveaway Summary
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Review your giveaway
                        before creating it.
                      </p>
                    </div>

                    <div className="space-y-3 text-sm">

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">
                          Gift
                        </span>

                        <span className="text-right font-semibold text-slate-200">
                          {type === "AIRTIME"
                            ? `${money(
                                airtimePrice
                              )} Airtime`
                            : selectedPlan?.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">
                          Recipients
                        </span>

                        <span className="font-semibold text-slate-200">
                          {recipientLimit ||
                            "—"}
                        </span>
                      </div>

                      <div className="border-t border-slate-800 pt-3">
                        <div className="flex items-end justify-between gap-4">

                          <div>
                            <p className="font-semibold text-white">
                              Maximum giveaway
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Maximum amount that
                              may be distributed.
                            </p>
                          </div>

                          <p className="text-xl font-bold text-blue-400">
                            {type ===
                            "AIRTIME"
                              ? money(
                                  airtimePrice *
                                    Number(
                                      recipientLimit ||
                                        0
                                    )
                                )
                              : money(
                                  selectedDataPrice *
                                    Number(
                                      recipientLimit ||
                                        0
                                    )
                                )}
                          </p>

                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* =================================================
                    ERROR
                    ================================================= */}

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
                    <div className="flex gap-3">

                      <span className="text-lg">
                        ⚠️
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-red-400">
                          Unable to create giveaway
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {error}
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                {/* =================================================
                    SUCCESS
                    ================================================= */}

                {message && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <div className="flex gap-3">

                      <span className="text-lg text-emerald-400">
                        ✓
                      </span>

                      <div>
                        <p className="text-sm font-semibold text-emerald-400">
                          Giveaway created
                        </p>

                        <p className="mt-1 text-sm text-slate-400">
                          {message}
                        </p>
                      </div>

                    </div>
                  </div>
                )}

                                              {/* =================================================
                    CREATE GIVEAWAY
                    ================================================= */}

                <button
                  type="button"
                  onClick={createGiveaway}
                  disabled={loading || loadingPlans}
                  className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#1d70f5] px-5 text-base font-extrabold text-white shadow-lg shadow-blue-500/10 transition-all hover:bg-blue-600 hover:shadow-blue-500/20 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Creating Giveaway...
                    </>
                  ) : (
                    <>
                      🎁
                      Create Giveaway
                    </>
                  )}
                </button>

              </div>
            </div>

          </div>

          {/* =====================================================
              GENERATED LINK
              ===================================================== */}

          {giftLink && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-emerald-500/20 bg-slate-900 shadow-xl">

              <div className="border-b border-slate-800 px-5 py-5 sm:px-7">
                <div className="flex items-center gap-3">

                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">
                    🔗
                  </div>

                  <div>
                    <h2 className="font-bold text-white">
                      Giveaway Created
                    </h2>
                  </div>

                </div>
              </div>

              <div className="p-5 sm:p-7">

                <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">

                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                    Giveaway Link
                  </div>

                  <div className="break-all text-sm leading-6 text-slate-300">
                    {giftLink}
                  </div>

                </div>

                <button
                  type="button"
                  onClick={copyLink}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-[0.99]"
                >
                  📋
                  Copy Giveaway Link
                </button>

                <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
                  <span>ℹ️</span>

                  <p>
                    Recipients only need to enter
                    their phone number to claim
                    their gift.
                  </p>
                </div>

              </div>
            </div>
                    )}

        </div>
      </div>
    </main>
  );
}