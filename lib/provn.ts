const base = (
  process.env.PROVN_BASE_URL || "https://api.provn.ng"
).replace(/\/+$/, "");

function headers() {
  const apiKey = process.env.PROVN_TEST_KEY || "";
  const accessKey = process.env.PROVN_ACCESS_KEY || "";

  return {
    "Content-Type": "application/json",
    "API-Key": apiKey,
    "Access-Key": accessKey,
    Accept: "application/json",
  };
}

async function verify(
  path: string,
  body: Record<string, unknown>
) {
  const url = `${base}${path}`;

  console.log("=== KYC PROVIDER REQUEST ===");
  console.log("URL:", url);
  console.log("METHOD: POST");
  console.log("BODY:", JSON.stringify(body));

  const r = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await r.text();

  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text,
    };
  }

  console.log("=== KYC PROVIDER RESPONSE ===");
  console.log("STATUS:", r.status);
  console.log("RESPONSE:", JSON.stringify(data, null, 2));

  if (!r.ok) {
    throw new Error(
      data?.detail ||
        data?.message ||
        data?.error ||
        data?.raw ||
        `KYC provider error (${r.status})`
    );
  }

  return data;
}

export const verifyNin = (nin: string) =>
  verify("/verification/nin", {
    nin,
  });

export const verifyBvn = (bvn: string) =>
  verify("/verification/bvn", {
    bvn,
  });