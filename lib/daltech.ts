const BASE = (
  process.env.DALTECH_BASE_URL ||
  "https://daltechsubapi.com.ng/api"
).replace(/\/+$/, "");

const KEY = process.env.DALTECH_API_KEY || "";

export class DaltechError extends Error {
  status: number;
  details: any;

  constructor(
    message: string,
    status = 502,
    details?: any
  ) {
    super(message);
    this.name = "DaltechError";
    this.status = status;
    this.details = details;
  }
}

async function request(
  path: string,
  method: "GET" | "POST",
  data?: Record<string, any>
) {
  if (!KEY) {
    throw new DaltechError(
      "DALTECH_API_KEY missing",
      500
    );
  }

  const url = new URL(`${BASE}${path}`);

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${KEY}`,
    "X-API-Key": KEY,
  };

  const options: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method === "GET" && data) {
    for (const [key, value] of Object.entries(data)) {
      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  if (method === "POST") {
    headers["Content-Type"] = "application/json";

    options.body = JSON.stringify(data || {});
  }

  console.log("DALTECH REQUEST URL:", url.toString());
  console.log("DALTECH REQUEST METHOD:", method);

  const response = await fetch(
    url.toString(),
    options
  );

  const text = await response.text();

  console.log(
    "DALTECH HTTP STATUS:",
    response.status
  );

  console.log(
    "DALTECH RAW RESPONSE:",
    text
  );

  let json: any;

  try {
    json = JSON.parse(text);
  } catch {
    json = {
      raw: text,
    };
  }

  if (!response.ok) {
    throw new DaltechError(
      json?.msg ||
        json?.message ||
        `Daltech returned HTTP ${response.status}`,
      response.status,
      json
    );
  }

  return json;
}

export const daltech = {
  services: (service: string) =>
    request("/services/", "GET", {
      service,
    }),

  electricityVerify: (data: any) =>
    request(
      "/electricity/verify/",
      "GET",
      data
    ),

  electricity: (data: any) =>
    request(
      "/electricity/",
      "GET",
      data
    ),

  cableVerify: (data: any) =>
    request(
      "/cable/verify/",
      "GET",
      data
    ),

  cable: (data: any) =>
    request(
      "/cabletv/",
      "GET",
      data
    ),

  exampin: (data: any) =>
    request(
      "/exampin/",
      "GET",
      data
    ),

  datapin: (data: any) =>
    request(
      "/datapin/",
      "GET",
      data
    ),

  rechargepin: (data: any) =>
    request(
      "/rechargepin/",
      "GET",
      data
    ),
};