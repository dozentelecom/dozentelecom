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
        new URL(
          `/kyc?error=${encodeURIComponent("Enter a valid 11-digit NIN")}`,
          req.url
        )
      );
    }

    const cookie = req.headers.get("cookie") || "";

    // Create the Flutterwave account only.
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

    // Flutterwave succeeded. Paystack is deliberately not called here.
    return NextResponse.redirect(
      new URL("/dashboard?flutterwaveSetup=success", req.url)
    );
  } catch (error: any) {
    console.error(
      "Flutterwave NIN account setup failed:",
      error?.message || "Unknown error"
    );

    return NextResponse.redirect(
      new URL(
        `/kyc?error=${encodeURIComponent(
          "We could not complete your Flutterwave account setup. Please try again."
        )}`,
        req.url
      )
    );
  }
}