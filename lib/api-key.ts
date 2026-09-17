import crypto from "crypto";

export type ApiKeyEnvironment = "TEST" | "LIVE";

/**
 * Generate a new Dozentelecom API key.
 *
 * TEST:
 *   OID/DT_TEST_...
 *
 * LIVE:
 *   OID/DT_LIVE_...
 *
 * The complete key is returned only when generated.
 * Only the SHA-256 hash is stored in MongoDB.
 */
export function generateApiKey(
  environment: ApiKeyEnvironment
) {
  const secret = crypto.randomBytes(32).toString("hex");

  const apiKey =
    environment === "TEST"
      ? `OID/DT_TEST_${secret}`
      : `OID/DT_LIVE_${secret}`;

  const apiKeyHash = crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");

  const apiKeyPrefix =
    apiKey.slice(0, environment === "TEST" ? 16 : 16);

  return {
    apiKey,
    apiKeyHash,
    apiKeyPrefix,
    environment,
  };
}

/**
 * Hash an API key supplied by an external website.
 */
export function hashApiKey(apiKey: string) {
  return crypto
    .createHash("sha256")
    .update(apiKey)
    .digest("hex");
}

/**
 * Check whether an API key has a valid format.
 */
export function isValidApiKey(apiKey: string) {
  return (
    /^OID\/DT_TEST_[a-f0-9]{64}$/.test(apiKey) ||
    /^OID\/DT_LIVE_[a-f0-9]{64}$/.test(apiKey)
  );
}

/**
 * Determine whether a key is TEST or LIVE.
 */
export function getApiKeyEnvironment(
  apiKey: string
): ApiKeyEnvironment | null {
  if (/^OID\/DT_TEST_[a-f0-9]{64}$/.test(apiKey)) {
    return "TEST";
  }

  if (/^OID\/DT_LIVE_[a-f0-9]{64}$/.test(apiKey)) {
    return "LIVE";
  }

  return null;
    }
