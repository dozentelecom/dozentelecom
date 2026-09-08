export type RateKey =
  | "data"
  | "electricity"
  | "cable"
  | "education"
  | "airtimeToCash"
  | "funding"
  | "withdrawal";

export type VipLevel =
  | "NORMAL"
  | "VIP1"
  | "VIP2"
  | "VIP3";

export type VipService =
  | "data"
  | "electricity"
  | "cable"
  | "education"
  | "airtimeToCash";

export const CAPS = {
  data: 15,
  electricity: 10,
  cable: 10,
  education: 25,
  airtimeToCash: 30,
  funding: 5,
  withdrawal: 5,
} as const;

export const DEFAULTS = {
  data: 5,
  electricity: 4,
  cable: 4,
  education: 15,
  airtimeToCash: 20,
  funding: 1.5,
  airtimeRoundUnit: 10,
  withdrawal: 0,
} as const;

export const SERVICE_DEFAULTS = {
  data: true,
  airtime: true,
  electricity: true,
  cable: true,
  education: true,
} as const;

export type ServiceKey = keyof typeof SERVICE_DEFAULTS;

/*
 * =========================================================
 * VIP DEFAULT RATES
 * =========================================================
 */

export const VIP_DEFAULTS = {
  vip1Price: 5000,
  vip2Price: 15000,
  vip3Price: 30000,

  vip1Data: 4,
  vip1Electricity: 3,
  vip1Cable: 3,
  vip1Education: 12,
  vip1AirtimeToCash: 18,

  vip2Data: 3,
  vip2Electricity: 2,
  vip2Cable: 2,
  vip2Education: 10,
  vip2AirtimeToCash: 15,

  vip3Data: 2,
  vip3Electricity: 1,
  vip3Cable: 1,
  vip3Education: 8,
  vip3AirtimeToCash: 12,
} as const;

/*
 * =========================================================
 * RATE VALIDATION
 * =========================================================
 */

export function assertRate(
  k: RateKey,
  v: number
) {
  if (
    !Number.isFinite(v) ||
    v < 0 ||
    v > CAPS[k]
  ) {
    throw new Error(
      `Rate for ${k} must be between 0% and ${CAPS[k]}%`
    );
  }

  return v;
}

/*
 * =========================================================
 * NORMAL PRICE CALCULATION
 * =========================================================
 */

export function percentPrice(
  cost: number,
  rate: number
) {
  return (
    Math.ceil(
      cost * (1 + rate / 100) * 100
    ) / 100
  );
}

/*
 * =========================================================
 * AIRTIME ROUNDING
 * =========================================================
 */

export function roundAirtime(
  cost: number,
  unit = 10
) {
  return Math.ceil(cost / unit) * unit;
}

/*
 * =========================================================
 * VIP RATE RESOLVER
 * =========================================================
 *
 * This is the central function used by customer purchase
 * APIs to determine the correct rate.
 *
 * NORMAL:
 *   rates.data
 *
 * VIP1:
 *   rates.vip1Data
 *
 * VIP2:
 *   rates.vip2Data
 *
 * VIP3:
 *   rates.vip3Data
 *
 * The same pattern applies to electricity, cable,
 * education and airtimeToCash.
 */

export function getVipRate(
  rates: Record<string, any>,
  vipLevel: VipLevel | string | undefined,
  service: VipService
): number {
  const level: VipLevel =
    vipLevel === "VIP1" ||
    vipLevel === "VIP2" ||
    vipLevel === "VIP3"
      ? vipLevel
      : "NORMAL";

  if (level === "NORMAL") {
    const normalRate = Number(
      rates?.[service]
    );

    if (Number.isFinite(normalRate)) {
      return normalRate;
    }

    return Number(
      DEFAULTS[service]
    );
  }

  const vipKey =
    `${level.toLowerCase()}${service
      .charAt(0)
      .toUpperCase()}${service.slice(1)}`;

  const vipRate = Number(
    rates?.[vipKey]
  );

  /*
   * Fallback to normal rate if an old Settings
   * document does not yet contain the VIP field.
   */
  if (Number.isFinite(vipRate)) {
    return vipRate;
  }

  const normalRate = Number(
    rates?.[service]
  );

  if (Number.isFinite(normalRate)) {
    return normalRate;
  }

  return Number(
    DEFAULTS[service]
  );
}