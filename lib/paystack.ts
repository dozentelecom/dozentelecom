const BASE = "https://api.paystack.co";

function headers() {
  return {
    Authorization: `Bearer ${
      process.env.PAYSTACK_SECRET_KEY || ""
    }`,
    "Content-Type": "application/json",
  };
}

export async function paystack(
  path: string,
  body: any
) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  const json = await response.json();

  if (!response.ok || !json.status) {
    throw new Error(
      json.message || "Paystack request failed"
    );
  }

  return json;
}

export async function paystackGet(
  path: string
) {
  const response = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: headers(),
  });

  const json = await response.json();

  if (!response.ok || !json.status) {
    throw new Error(
      json.message || "Paystack request failed"
    );
  }

  return json;
}