export async function verifyIdentity(
  type: "nin" | "bvn" | "phone",
  value: string
) {
  const base =
    process.env.CLOUDEYE_BASE_URL || "https://api.cloudeye.ng";

  const r = await fetch(`${base}/verification/${type}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": process.env.PROVN_TEST_KEY || "",
      "Access-Key": process.env.PROVN_ACCESS_KEY || "",
    },
    body: JSON.stringify({
      [type]: value,
    }),
    cache: "no-store",
  });

  const j = await r.json();

  if (!r.ok) {
    throw new Error(j?.message || "Verification failed");
  }

  return j;
}