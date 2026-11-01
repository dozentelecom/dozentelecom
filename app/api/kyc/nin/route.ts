
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    const body = contentType.includes("form")
      ? Object.fromEntries((await req.formData()).entries())
      : await req.json();

    const nin = String((body as any)?.nin || "").replace(/\s/g, "");

    if (!/^\d{11}$/.test(nin)) {
      return NextResponse.redirect(
        new URL("/kyc?error=Enter%20a%20valid%2011-digit%20NIN", req.url)
      );
    }

    const cookie = req.headers.get("cookie") || "";

    // STEP 1: Create the customer's Flutterwave permanent account.
    // The Flutterwave endpoint handles the atomic account-creation lock.
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
      const message =
        flutterwaveResult?.error ||
        "Flutterwave could not accept your NIN or create your account.";

      return NextResponse.redirect(
        new URL(`/kyc?error=${encodeURIComponent(message)}`, req.url)
      );
    }

    // STEP 2: Flutterwave succeeded. Automatically request Paystack.
    // The NIN is not sent to Paystack.
    let paystackStatus: "PENDING" | "REQUESTED" | "FAILED" = "FAILED";

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

      const paystackResult: any = await paystackResponse
        .json()
        .catch(() => ({}));

      if (paystackResponse.ok && paystackResult?.success) {
        paystackStatus = paystackResult.pending ? "PENDING" : "REQUESTED";
      } else {
        console.error("Automatic Paystack account request failed:", {
          status: paystackResponse.status,
          message: String(
            paystackResult?.error || "Unknown error"
          ).slice(0, 200),
        });
      }
    } catch (error: any) {
      console.error(
        "Automatic Paystack request error:",
        error?.message || "Unknown error"
      );
    }

    // Flutterwave remains successful even if Paystack is pending or fails.
    const destination =
      paystackStatus === "FAILED"
        ? "/dashboard?accountSetup=partial"
        : "/dashboard?accountSetup=started";

    return NextResponse.redirect(new URL(destination, req.url));
  } catch (error: any) {
    console.error(
      "NIN account setup failed:",
      error?.message || "Unknown error"
    );

    return NextResponse.redirect(
      new URL(
        `/kyc?error=${encodeURIComponent(
          "We could not complete your account setup. Please try again."
        )}`,
        req.url
      )
    );
  }
}
