import { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { ApiCustomer } from "@/lib/models";
import {
  getApiKeyEnvironment,
  hashApiKey,
  isValidApiKey,
  type ApiKeyEnvironment,
} from "@/lib/api-key";

export type AuthenticatedApiCustomer = {
  customer: any;
  environment: ApiKeyEnvironment;
};

/**
 * Authenticate a Dozentelecom API request.
 *
 * API key must be supplied through:
 *
 * X-API-Key: OID/DT_TEST_...
 *
 * or:
 *
 * X-API-Key: OID/DT_LIVE_...
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<AuthenticatedApiCustomer | null> {
  const apiKey =
    request.headers.get("x-api-key")?.trim() || "";

  if (!apiKey || !isValidApiKey(apiKey)) {
    return null;
  }

  const environment = getApiKeyEnvironment(apiKey);

  if (!environment) {
    return null;
  }

  await db();

  const apiKeyHash = hashApiKey(apiKey);

  const customer =
    environment === "TEST"
      ? await ApiCustomer.findOne({
          testApiKeyHash: apiKeyHash,
          status: "ACTIVE",
        })
      : await ApiCustomer.findOne({
          liveApiKeyHash: apiKeyHash,
          status: "ACTIVE",
        });

  if (!customer) {
    return null;
  }

  return {
    customer,
    environment,
  };
  }
