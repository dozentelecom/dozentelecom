import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiCustomer } from "@/lib/models";
import { generateApiKey } from "@/lib/api-key";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    await db();

    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    const companyName = String(
      body.companyName || ""
    ).trim();

    if (!name || !email) {
      return NextResponse.json(
        {
          success: false,
          message: "Name and email are required.",
        },
        { status: 400 }
      );
    }

    const existing = await ApiCustomer.findOne({
      email,
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message:
            "An API customer with this email already exists.",
        },
        { status: 409 }
      );
    }

    const testKey = generateApiKey("TEST");
    const liveKey = generateApiKey("LIVE");

    const customer = await ApiCustomer.create({
      name,
      email,
      companyName,

      testApiKeyHash: testKey.apiKeyHash,
      testApiKeyPrefix: testKey.apiKeyPrefix,

      liveApiKeyHash: liveKey.apiKeyHash,
      liveApiKeyPrefix: liveKey.apiKeyPrefix,

      balanceKobo: 0,

      status: "ACTIVE",

      services: {
        airtime: true,
        data: true,
        electricity: false,
        cable: false,
        education: false,
      },

      rateMarkup: 0,
      monthlyLimitKobo: 0,

      notes: "",
    });

    return NextResponse.json({
      success: true,

      customer: {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email,
        companyName: customer.companyName,
        status: customer.status,
      },

      apiKeys: {
        test: testKey.apiKey,
        live: liveKey.apiKey,
      },

      message:
        "API customer created. Store the API keys securely; they will not be shown again.",
    });
  } catch (error) {
    console.error(
      "CREATE API CUSTOMER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create API customer.",
      },
      { status: 500 }
    );
  }
      }
