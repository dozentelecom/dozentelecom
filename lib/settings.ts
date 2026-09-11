import { db } from "./db";
import { Settings } from "./models";
import {
  DEFAULTS,
  VIP_DEFAULTS,
  assertRate,
  RateKey,
} from "./pricing";

export async function getRates() {
  await db();

  const row: any = await Settings.findOne({
    key: "pricing",
  }).lean();

  return {
    ...DEFAULTS,
    ...VIP_DEFAULTS,
    ...(row?.rates || {}),
  };
}

export async function saveRates(input: any) {
  await db();

  // Start with existing saved rates so values not submitted
  // by the admin are not accidentally erased.
  const existing: any =
    await Settings.findOne({
      key: "pricing",
    }).lean();

  const rates: any = {
    ...DEFAULTS,
    ...VIP_DEFAULTS,
    ...(existing?.rates || {}),
  };

  /* =========================================================
     NORMAL RATES
     ========================================================= */

  for (const k of Object.keys(DEFAULTS) as string[]) {
    if (input[k] === undefined) continue;

    const n = Number(input[k]);

    if (
      k !== "airtimeRoundUnit"
    ) {
      assertRate(
        k as RateKey,
        n
      );
    }

    if (
      k === "airtimeRoundUnit" &&
      (!Number.isFinite(n) || n < 1)
    ) {
      throw new Error(
        "Round unit must be at least 1"
      );
    }

    rates[k] = n;
  }

  /* =========================================================
     VIP PRICES
     ========================================================= */

  const vipPrices = [
    "vip1Price",
    "vip2Price",
    "vip3Price",
  ];

  for (const k of vipPrices) {
    if (input[k] === undefined) continue;

    const n = Number(input[k]);

    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(
        `${k} must be greater than 0`
      );
    }

    rates[k] = n;
  }

  /* =========================================================
     VIP SERVICE RATES
     ========================================================= */

  const vipRateKeys = [
    "vip1Data",
    "vip1Electricity",
    "vip1Cable",
    "vip1Education",
    "vip1AirtimeToCash",

    "vip2Data",
    "vip2Electricity",
    "vip2Cable",
    "vip2Education",
    "vip2AirtimeToCash",

    "vip3Data",
    "vip3Electricity",
    "vip3Cable",
    "vip3Education",
    "vip3AirtimeToCash",
  ];

  for (const k of vipRateKeys) {
    if (input[k] === undefined) continue;

    const n = Number(input[k]);

    if (!Number.isFinite(n) || n < 0 || n > 30) {
      throw new Error(
        `${k} must be between 0% and 30%`
      );
    }

    rates[k] = n;
  }

  /* =========================================================
     VALIDATE VIP PRICE ORDER
     ========================================================= */

  if (
    rates.vip1Price >= rates.vip2Price ||
    rates.vip2Price >= rates.vip3Price
  ) {
    throw new Error(
      "VIP prices must increase from VIP1 to VIP3"
    );
  }

  /* =========================================================
     SAVE
     ========================================================= */

  await Settings.findOneAndUpdate(
    { key: "pricing" },
    {
      key: "pricing",
      rates,
    },
    {
      upsert: true,
      new: true,
    }
  );

  return rates;
}