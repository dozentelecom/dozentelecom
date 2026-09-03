const BASE = (
  process.env.WIZESUB_BASE_URL ||
  "https://app.wisesub.com.ng/api/partner/v1"
).replace(/\/+$/, "");

const API_KEY = process.env.WIZESUB_API_KEY || "";
const API_SECRET = process.env.WIZESUB_API_SECRET || "";
const ENVIRONMENT = process.env.WIZESUB_ENVIRONMENT || "test";

export class WiseSubError extends Error {
  status: number;
  details: any;

  constructor(
    message: string,
    status = 502,
    details?: any
  ) {
    super(message);
    this.name = "WiseSubError";
    this.status = status;
    this.details = details;
  }
}

async function request(
  path: string,
  method: "GET" | "POST",
  data?: Record<string, any>
) {
  if (!API_KEY) {
    throw new WiseSubError(
      "WIZESUB_API_KEY is missing",
      500
    );
  }

  if (!API_SECRET) {
    throw new WiseSubError(
      "WIZESUB_API_SECRET is missing",
      500
    );
  }

  const url = new URL(`${BASE}${path}`);

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "X-API-Secret": API_SECRET,
      "X-Environment": ENVIRONMENT,
      Accept: "application/json",
    },
    cache: "no-store",
  };

  if (method === "GET" && data) {
    Object.entries(data).forEach(([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  if (method === "POST") {
    options.headers = {
      ...options.headers,
      "Content-Type": "application/json",
    };

    options.body = JSON.stringify(data || {});
  }

  console.log("=== WISESUB REQUEST ===");
  console.log("URL:", url.toString());
  console.log("METHOD:", method);
  console.log("ENVIRONMENT:", ENVIRONMENT);

  const response = await fetch(
    url.toString(),
    options
  );

  const text = await response.text();

  console.log("WISESUB HTTP STATUS:", response.status);
  console.log("WISESUB RAW RESPONSE:", text);

  let json: any;

  try {
    json = JSON.parse(text);
  } catch {
    json = {
      raw: text,
    };
  }

  if (!response.ok) {
    throw new WiseSubError(
      json?.message ||
        json?.error ||
        json?.msg ||
        `WiseSub request failed with status ${response.status}`,
      response.status,
      json
    );
  }

  return json;
}

export const wisesub = {
  /**
   * Get all available services
   */
  services: () =>
    request("/services", "GET"),

  /**
   * Get packages for a service/provider
   */
  packages: (
    service_type: string,
    provider_code: string
  ) =>
    request("/packages", "GET", {
      service_type,
      provider_code,
    }),

  /**
   * Verify electricity meter or cable decoder
   */
  verify: (data: Record<string, any>) =>
    request("/verify", "POST", data),

  /**
   * Purchase electricity, cable TV or education PIN
   */
  purchase: (data: Record<string, any>) =>
    request("/purchase", "POST", data),

  /**
   * Check transaction status
   */
  status: (reference: string) =>
    request("/status", "GET", {
      reference,
    }),
};