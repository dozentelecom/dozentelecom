import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Funding } from "@/lib/models";
import { getRates } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let reference = "";

  try {
    // AUTHENTICATION
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // READ AMOUNT
    const formData = await req.formData();
    const amount = Number(formData.get("amount"));

    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json(
        { error: "Minimum funding is ₦100." },
        { status: 400 }
      );
    }

    const grossKobo = Math.round(amount * 100);

    if (!Number.isInteger(grossKobo) || grossKobo < 10000) {
      return NextResponse.json(
        { error: "Minimum funding is ₦100." },
        { status: 400 }
      );
    }

    // DATABASE
    await db();

    const user: any = await User.findById(userId).lean();

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // CUSTOMER MUST HAVE COMPLETED FLUTTERWAVE ACCOUNT SETUP
    if (
      user.kyc?.flutterwaveDvaStatus !== "ACTIVE" ||
      !user.kyc?.flutterwaveAccountNumber
    ) {
      return NextResponse.redirect(new URL("/kyc", req.url));
    }

    // FLUTTERWAVE CONFIGURATION
    const secretKey = process.env.FLW_SECRET_KEY;
    const callbackUrl = process.env.FLW_FUNDING_CALLBACK_URL;

    if (!secretKey || !callbackUrl) {
      console.error("Flutterwave funding configuration is incomplete.");

      return NextResponse.json(
        { error: "Flutterwave funding is not configured." },
        { status: 503 }
      );
    }

    // FUNDING RATE
    const rates = await getRates();
    const fundingRate = Number(rates.funding ?? 0);

    if (!Number.isFinite(fundingRate) || fundingRate < 0) {
      return NextResponse.json(
        { error: "Invalid funding rate configuration." },
        { status: 500 }
      );
    }

    // FEE CALCULATION
    const feeKobo = Math.ceil((grossKobo * fundingRate) / 100);
    const creditKobo = grossKobo - feeKobo;

    if (creditKobo <= 0) {
      return NextResponse.json(
        { error: "Funding amount is too small for the configured fee." },
        { status: 400 }
      );
    }

    // UNIQUE FUNDING REFERENCE
    reference =
      `DZT-FLW-FUND-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

    // CREATE FUNDING RECORD
    await Funding.create({
      userId,
      reference,
      grossKobo,
      feeKobo,
      creditKobo,
      status: "PENDING",
      providerData: {
        provider: "FLUTTERWAVE",
        paymentType: "HOSTED_CHECKOUT",
      },
    });

    // INITIALIZE FLUTTERWAVE CHECKOUT
    const customerName = String(user.name || "Customer").trim();
    const names = customerName.split(/\s+/);

    const response = await fetch(
      "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: (grossKobo / 100).toFixed(2),
          currency: "NGN",
          redirect_url: callbackUrl,
          customer: {
            email: String(user.email || "").trim(),
            name: customerName,
            phonenumber: String(
              user.phone || user.phoneNumber || ""
            ).trim(),
          },
          customizations: {
            title: "Dozentelecom Wallet Funding",
            description: "Wallet funding payment",
            logo: process.env.NEXT_PUBLIC_APP_LOGO || "",
          },
          meta: {
            userId: String(userId),
            fundingReference: reference,
            grossKobo,
            feeKobo,
            creditKobo,
          },
        }),
        cache: "no-store",
      }
    );

    const result: any = await response.json().catch(() => ({}));
    const checkoutUrl = result?.data?.link;

    if (
      !response.ok ||
      result?.status !== "success" ||
      !checkoutUrl
    ) {
      await Funding.findOneAndUpdate(
        { reference, status: "PENDING" },
        {
          $set: {
            status: "FAILED",
            "providerData.initializationError": String(
              result?.message || "Flutterwave initialization failed"
            ).slice(0, 200),
          },
        }
      );

      console.error("Flutterwave checkout initialization failed:", {
        httpStatus: response.status,
        providerMessage: String(result?.message || "Unknown error").slice(0, 200),
      });

      return NextResponse.json(
        { error: "Unable to initialize Flutterwave payment. Please try again." },
        { status: 502 }
      );
    }

    // SAVE PROVIDER REFERENCE AND CHECKOUT DETAILS
    await Funding.findOneAndUpdate(
      { reference },
      {
        $set: {
          providerData: {
            provider: "FLUTTERWAVE",
            paymentType: "HOSTED_CHECKOUT",
            txRef: reference,
            checkoutUrl,
          },
        },
      }
    );

    // REDIRECT CUSTOMER TO FLUTTERWAVE
    return NextResponse.redirect(checkoutUrl, { status: 303 });
  } catch (error: any) {
    console.error(
      "Flutterwave wallet funding initialization error:",
      error?.message || "Unknown error"
    );

    if (reference) {
      try {
        await db();
        await Funding.findOneAndUpdate(
          { reference, status: "PENDING" },
          { $set: { status: "FAILED" } }
        );
      } catch {}
    }

    return NextResponse.json(
      { error: "Unable to process your funding request right now." },
      { status: 500 }
    );
  }
}