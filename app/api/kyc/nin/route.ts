import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const isJson = (req.headers.get("content-type") || "").includes(
    "application/json"
  );

  const respond = (
    success: boolean,
    data: Record<string, unknown>,
    redirectPath: string
  ) => {
    if (isJson) {
      return NextResponse.json(data, {
        status: success ? 200 : 400,
      });
    }

    return NextResponse.redirect(new URL(redirectPath, req.url));
  };

  const id = await currentUserId();

  if (!id) {
    return respond(
      false,
      { success: false, error: "Please log in to continue." },
      "/login"
    );
  }

  try {
    const body = isJson
      ? await req.json()
      : Object.fromEntries((await req.formData()).entries());

    const nin = String(body?.nin || "").replace(/\s/g, "");

    if (!/^\d{11}$/.test(nin)) {
      return respond(
        false,
        { success: false, error: "Enter a valid 11-digit NIN." },
        "/kyc?error=Enter%20a%20valid%2011-digit%20NIN"
      );
    }

    const cookie = req.headers.get("cookie") || "";

    // FIRST: Create or retrieve the Flutterwave account.
    const flutterwaveResponse = await fetch(
      new URL("/api/flutterwave/dva", req.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ nin }),
        cache: "no-store",
      }
    );

    const flutterwaveResult: any = await flutterwaveResponse
      .json()
      .catch(() => ({}));

    if (
      !flutterwaveResponse.ok ||
      !flutterwaveResult?.success ||
      !flutterwaveResult?.accountNumber ||
      flutterwaveResult?.status !== "ACTIVE"
    ) {
      const error =
        flutterwaveResult?.error ||
        "Flutterwave could not verify your NIN or create your account.";

      return respond(
        false,
        { success: false, error, provider: "FLUTTERWAVE" },
        `/kyc?error=${encodeURIComponent(error)}`
      );
    }

    // SECOND: Only after Flutterwave succeeds, request Paystack.
    // The NIN is not forwarded to Paystack by this route.
    let paystackResult: any = {};
    let paystackCreated = false;
    let paystackError = "";

    try {
      const paystackResponse = await fetch(
        new URL("/api/paystack/dva", req.url),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie,
          },
          body: JSON.stringify({}),
          cache: "no-store",
        }
      );

      paystackResult = await paystackResponse
        .json()
        .catch(() => ({}));

      paystackCreated =
        paystackResponse.ok && paystackResult?.success === true;

      if (!paystackCreated) {
        paystackError =
          paystackResult?.error ||
          "Flutterwave account created, but Paystack account generation is not complete.";
      }
    } catch (error: any) {
      paystackError =
        error?.message ||
        "Flutterwave account created, but Paystack could not be reached.";
    }

    // Flutterwave remains successful even if Paystack needs a retry.
    if (isJson) {
      return NextResponse.json({
        success: true,
        flutterwave: {
          success: true,
          accountNumber: flutterwaveResult.accountNumber,
          bankName: flutterwaveResult.bankName || "",
          accountName: flutterwaveResult.accountName || "",
          status: flutterwaveResult.status || "ACTIVE",
        },
        paystack: {
          success: paystackCreated,
          pending: Boolean(paystackResult?.pending),
          error: paystackError || undefined,
        },
        message: paystackCreated
          ? "Both virtual account requests have been completed."
          : "Flutterwave account created. Paystack account generation needs to be retried.",
      });
    }

    const destination = paystackCreated
      ? "/dashboard?accountSetup=complete"
      : "/dashboard?accountSetup=partial";

    return NextResponse.redirect(new URL(destination, req.url));
  } catch (error: any) {
    console.error(
      "Unified NIN account setup failed:",
      error?.message || "Unknown error"
    );

    const message =
      "We could not complete your account setup. Please try again.";

    return respond(
      false,
      { success: false, error: message },
      `/kyc?error=${encodeURIComponent(message)}`
    );
  }
}