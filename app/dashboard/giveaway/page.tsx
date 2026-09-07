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
    minimumFractionDigits:
      amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function GiveawayPage() {
  const [type, setType] =
    useState<GiftType>("AIRTIME");

  const [plans, setPlans] =
    useState<DataPlan[]>([]);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [dataMarkup, setDataMarkup] =
    useState(0);

  const [airtimeRoundUnit, setAirtimeRoundUnit] =
    useState(10);

  const [network, setNetwork] =
    useState("");

  const [serviceType, setServiceType] =
    useState("");

  const [dataPlan, setDataPlan] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [recipientLimit, setRecipientLimit] =
    useState("");

  const [pin, setPin] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [giftLink, setGiftLink] =
    useState("");

  /*
   * =========================================================
   * LOAD SME DATA PLANS
   * =========================================================
   */

  useEffect(() => {
    loadPlans();
    loadPricing();
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to load data plans"
        );
      }

      const rawPlans =
        Array.isArray(data)
          ? data
          : Array.isArray(data?.plans)
          ? data.plans
          : Array.isArray(data?.data)
          ? data.data
          : [];

      const normalized: DataPlan[] =
        rawPlans
          .map(
            (
              p: any,
              index: number
            ) => ({
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
            })
          )
          .filter(
            (p: DataPlan) =>
              p.id &&
              Number.isFinite(p.price) &&
              p.price > 0
          );

      setPlans(normalized);
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load data plans"
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
        "/api/admin/settings",
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      const pricing =
        data?.settings?.pricing ??
        data?.pricing ??
        data?.settings ??
        {};

      setDataMarkup(
        Number(
          pricing?.data ?? 0
        )
      );

      setAirtimeRoundUnit(
        Math.max(
          1,
          Number(
            pricing?.airtimeRoundUnit ??
              10
          )
        )
      );
    } catch {
      /*
       * Server-side pricing remains authoritative.
       */
    }
  }

  /*
   * =========================================================
   * NETWORK OPTIONS
   * =========================================================
   */

  const networkOptions =
    useMemo(() => {
      const map = new Map<
        string,
        string
      >();

      for (const plan of plans) {
        const id =
          plan.networkId ||
          plan.network;

        if (!id) continue;

        const name =
          plan.network &&
          !/^\d+$/.test(
            plan.network
          )
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

      return Array.from(
        map.entries()
      ).map(
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

  const serviceTypes =
    useMemo(() => {
      if (!network) return [];

      const values =
        new Set<string>();

      plans
        .filter(
          (p: DataPlan) =>
            p.networkId === network ||
            p.network === network
        )
        .forEach(
          (p: DataPlan) => {
            if (p.type) {
              values.add(p.type);
            }
          }
        );

      return Array.from(values);
    }, [plans, network]);

  /*
   * =========================================================
   * FILTERED DATA PLANS
   * =========================================================
   */

  const filteredPlans =
    useMemo(() => {
      return plans.filter(
        (p: DataPlan) => {
          const networkMatch =
            !network ||
            p.networkId === network ||
            p.network === network;

          const typeMatch =
            !serviceType ||
            p.type === serviceType;

          return (
            networkMatch &&
            typeMatch
          );
        }
      );
    }, [
      plans,
      network,
      serviceType,
    ]);

  /*
   * =========================================================
   * SELECTED DATA PLAN
   * =========================================================
   */

  const selectedPlan =
    useMemo(() => {
      return plans.find(
        (p: DataPlan) =>
          p.id === dataPlan
      );
    }, [
      plans,
      dataPlan,
    ]);

  /*
   * =========================================================
   * DATA CUSTOMER PRICE
   * =========================================================
   */

  const selectedDataPrice =
    selectedPlan
      ? percentPrice(
          selectedPlan.price,
          dataMarkup
        )
      : 0;

  /*
   * =========================================================
   * AIRTIME PRICE
   * =========================================================
   */

  const airtimePrice =
    useMemo(() => {
      const value =
        Number(amount);

      if (
        !Number.isFinite(
          value
        ) ||
        value <= 0
      ) {
        return 0;
      }

      return (
        Math.ceil(
          value /
            airtimeRoundUnit
        ) *
        airtimeRoundUnit
      );
    }, [
      amount,
      airtimeRoundUnit,
    ]);

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
        setError(
          "Select a network."
        );
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
        Number(recipientLimit) <
          1
      ) {
        setError(
          "Enter the number of recipients."
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
                type === "AIRTIME"
                  ? Number(amount)
                  : undefined,

              data_plan:
                type === "DATA"
                  ? Number(dataPlan)
                  : undefined,

              recipientLimit:
                Number(
                  recipientLimit
                ),

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

    await navigator.clipboard.writeText(
      giftLink
    );

    setMessage(
      "Giveaway link copied!"
    );
  }

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <main className="min-h-screen p-5 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">

            <div className="h-11 w-11 rounded-2xl border flex items-center justify-center text-2xl">
              🎁
            </div>

            <div>
              <h1 className="text-3xl font-bold">
                Create Giveaway
              </h1>

              <p className="text-sm text-gray-500">
                Send Airtime or Data to
                multiple recipients through
                one secure link.
              </p>
            </div>

          </div>
        </div>

        {/* FORM */}

        <div className="rounded-3xl border shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">

            {/* GIFT TYPE */}

            <div className="mb-6">

              <label className="block text-sm font-semibold mb-2">
                Gift Type
              </label>

              <div className="grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setType(
                      "AIRTIME"
                    );
                    setDataPlan("");
                    setServiceType("");
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    type ===
                    "AIRTIME"
                      ? "border-current"
                      : ""
                  }`}
                >
                  <div className="text-xl mb-1">
                    📱
                  </div>

                  <div className="font-semibold">
                    Airtime
                  </div>

                  <div className="text-xs text-gray-500">
                    Send airtime credit
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType(
                      "DATA"
                    );
                    setAmount("");
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${
                    type ===
                    "DATA"
                      ? "border-current"
                      : ""
                  }`}
                >
                  <div className="text-xl mb-1">
                    🌐
                  </div>

                  <div className="font-semibold">
                    Data
                  </div>

                  <div className="text-xs text-gray-500">
                    Send a data bundle
                  </div>
                </button>

              </div>
            </div>

            {/* NETWORK */}

            <div className="mb-6">

              <label className="block text-sm font-semibold mb-2">
                Network
              </label>

              <select
                value={network}
                onChange={(e) => {
                  setNetwork(
                    e.target.value
                  );
                  setDataPlan("");
                  setServiceType("");
                }}
                className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none"
              >
                <option value="">
                  Select network
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

            </div>

            {/* AIRTIME */}

            {type ===
              "AIRTIME" && (
              <div className="mb-6">

                <label className="block text-sm font-semibold mb-2">
                  Airtime Amount
                </label>

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
                  className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none"
                />

                {airtimePrice >
                  0 && (
                  <div className="mt-3 rounded-xl border p-3">

                    <div className="text-xs text-gray-500">
                      Amount to be used
                    </div>

                    <div className="font-bold text-lg">
                      {money(
                        airtimePrice
                      )}
                    </div>

                    {airtimePrice !==
                      Number(
                        amount
                      ) && (
                      <div className="text-xs text-gray-500 mt-1">
                        Rounded using your
                        configured airtime
                        unit of{" "}
                        {money(
                          airtimeRoundUnit
                        )}
                      </div>
                    )}

                  </div>
                )}

              </div>
            )}

            {/* DATA */}

            {type === "DATA" && (
              <>
                {serviceTypes.length >
                  0 && (
                  <div className="mb-6">

                    <label className="block text-sm font-semibold mb-2">
                      Data Service
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
                      className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none"
                    >
                      <option value="">
                        All available
                        services
                      </option>

                      {serviceTypes.map(
                        (
                          service
                        ) => (
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

                  </div>
                )}

                <div className="mb-6">

                  <label className="block text-sm font-semibold mb-2">
                    Data Plan
                  </label>

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
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none disabled:opacity-50"
                  >
                    <option value="">
                      {loadingPlans
                        ? "Loading data plans..."
                        : !network
                        ? "Select a network first"
                        : "Select a data plan"}
                    </option>

                    {filteredPlans.map(
                      (
                        plan
                      ) => (
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

                </div>

                {selectedPlan && (
                  <div className="mb-6 rounded-2xl border p-5">

                    <div className="text-sm text-gray-500 mb-1">
                      Selected Gift
                    </div>

                    <div className="font-bold text-lg">
                      {
                        selectedPlan.name
                      }
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">

                      <div>
                        <div className="text-xs text-gray-500">
                          Provider price
                        </div>

                        <div className="text-sm">
                          {money(
                            selectedPlan.price
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-500">
                          Customer/Giveaway
                          price
                        </div>

                        <div className="text-xl font-bold">
                          {money(
                            selectedDataPrice
                          )}
                        </div>
                      </div>

                    </div>

                    {dataMarkup >
                      0 && (
                      <div className="text-xs text-gray-500 mt-3">
                        Includes your
                        configured{" "}
                        {dataMarkup}%
                        Data markup.
                      </div>
                    )}

                  </div>
                )}

              </>
            )}

            {/* RECIPIENTS */}

            <div className="mb-6">

              <label className="block text-sm font-semibold mb-2">
                Number of Recipients
              </label>

              <input
                type="number"
                min="1"
                placeholder="10"
                value={
                  recipientLimit
                }
                onChange={(e) =>
                  setRecipientLimit(
                    e.target
                      .value
                  )
                }
                className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none"
              />

              <p className="text-xs text-gray-500 mt-2">
                Each phone number can claim
                this giveaway only once.
              </p>

            </div>

            {/* PIN */}

            <div className="mb-6">

              <label className="block text-sm font-semibold mb-2">
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
                className="w-full rounded-xl border px-4 py-3 bg-transparent outline-none tracking-[0.4em]"
              />

            </div>

            {/* SUMMARY */}

            {(type ===
              "AIRTIME"
              ? airtimePrice >
                0
              : !!selectedPlan) && (
              <div className="rounded-2xl border p-5 mb-6">

                <div className="text-sm font-semibold mb-4">
                  Giveaway Summary
                </div>

                <div className="space-y-3 text-sm">

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">
                      Gift
                    </span>

                    <span className="font-medium text-right">
                      {type ===
                      "AIRTIME"
                        ? `${money(
                            airtimePrice
                          )} Airtime`
                        : selectedPlan?.name}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">

                    <span className="text-gray-500">
                      Recipients
                    </span>

                    <span className="font-medium">
                      {recipientLimit ||
                        "—"}
                    </span>

                  </div>

                  <div className="border-t pt-3 flex justify-between gap-4">

                    <span className="font-semibold">
                      Maximum giveaway
                      value
                    </span>

                    <span className="font-bold">

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

                    </span>

                  </div>

                </div>
              </div>
            )}

            {/* ERRORS */}

            {error && (
              <div className="rounded-xl border p-4 mb-4 text-sm">
                {error}
              </div>
            )}

            {/* SUCCESS MESSAGE */}

            {message && (
              <div className="rounded-xl border p-4 mb-4 text-sm">
                {message}
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
              className="w-full rounded-xl px-5 py-4 font-semibold disabled:opacity-50"
            >
              {loading
                ? "Creating Giveaway..."
                : "🎁 Create Giveaway"}
            </button>

            <div className="mt-4 text-center text-xs text-gray-500">
              Your transaction PIN is used
              only to authorize the giveaway.
            </div>

          </div>
        </div>

        {/* GENERATED LINK */}

        {giftLink && (
          <div className="mt-6 rounded-3xl border p-6 md:p-8">

            <div className="flex items-center gap-3 mb-4">

              <div className="text-3xl">
                🔗
              </div>

              <div>
                <h2 className="font-bold text-lg">
                  Giveaway Created
                </h2>

                <p className="text-sm text-gray-500">
                  Share this link with your
                  recipients.
                </p>
              </div>

            </div>

            <div className="rounded-xl border p-4 break-all text-sm mb-4">
              {giftLink}
            </div>

            <button
              type="button"
              onClick={
                copyLink
              }
              className="w-full rounded-xl px-5 py-3 font-semibold"
            >
              📋 Copy Giveaway Link
            </button>

            <p className="text-xs text-gray-500 text-center mt-4">
              Recipients only need to enter
              their phone number to claim their
              gift.
            </p>

          </div>
        )}

      </div>
    </main>
  );
}