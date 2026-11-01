import type {
  LegitDataRequest,
  LegitAirtimeRequest,
  LegitProviderResponse,
} from "./types";

const BASE_URL = (
  process.env.LEGITDATAWAY_BASE_URL || "https://legitdataway.com"
).replace(/\/+$/, "");

const CATALOG_URL =
  process.env.LEGITDATAWAY_CATALOG_URL ||
  `${BASE_URL}/api/website/app/network`;

const API_USERNAME = process.env.LEGITDATAWAY_USERNAME;
const API_PASSWORD = process.env.LEGITDATAWAY_PASSWORD;

let cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  if (!API_USERNAME || !API_PASSWORD) {
    throw new Error("Legitdataway credentials are not configured");
  }

  const credentials = Buffer.from(
    `${API_USERNAME}:${API_PASSWORD}`
  ).toString("base64");

  const response = await fetch(`${BASE_URL}/api/user`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  let data: Record<string, unknown>;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Legitdataway authentication returned invalid JSON (${response.status})`
    );
  }

  const token =
    typeof data.AccessToken === "string" ? data.AccessToken : "";

    if (!response.ok || data.status !== "success" || !token) {
    const providerMessage =
      typeof data.message === "string"
        ? data.message.slice(0, 200)
        : typeof data.error === "string"
          ? data.error.slice(0, 200)
          : "No error message supplied";

    throw new Error(
      `Legitdataway authentication failed (${response.status}): ${providerMessage}`
    );
  }

  cachedToken = token;
  return token;
}

async function postPurchase(
  endpoint: "/api/data" | "/api/topup",
  payload: Record<string, unknown>
): Promise<LegitProviderResponse> {
  const token = await getAccessToken();

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Legitdataway purchase returned invalid JSON (${response.status})`
    );
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Legitdataway returned an unexpected response");
  }

  if (!response.ok) {
    throw new Error(
      `Legitdataway purchase request failed (${response.status})`
    );
  }

  return data as LegitProviderResponse;
}

export async function getDataCatalogue(): Promise<unknown> {
  const token = await getAccessToken();
  const url = new URL(CATALOG_URL);

  url.searchParams.set("type", "data");
  url.searchParams.set("token", token);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Legitdataway catalogue returned invalid JSON (${response.status})`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Legitdataway catalogue request failed (${response.status})`
    );
  }

  return data;
}

export async function purchaseData(
  params: LegitDataRequest
): Promise<LegitProviderResponse> {
  return postPurchase("/api/data", {
    network: params.network,
    phone: params.phone,
    data_plan: params.data_plan,
    bypass: params.bypass ?? false,
    "request-id": params.requestId,
  });
}

export async function purchaseAirtime(
  params: LegitAirtimeRequest
): Promise<LegitProviderResponse> {
  return postPurchase("/api/topup", {
    network: params.network,
    phone: params.phone,
    amount: params.amount,
    bypass: params.bypass ?? false,
    "request-id": params.requestId,
  });
}