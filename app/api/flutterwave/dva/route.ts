import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeAccountResponse(user: any) {
  const kyc = user?.kyc || {};
  return {
    success: true,
    accountNumber: kyc.flutterwaveAccountNumber || "",
    bankName: kyc.flutterwaveBankName || "",
    accountName: kyc.flutterwaveAccountName || user?.name || "",
    status: kyc.flutterwaveDvaStatus || "",
    txRef: kyc.flutterwaveTxRef || "",
    identityStatus:
      kyc.status === "VERIFIED"
        ? "INDEPENDENTLY_VERIFIED_BY_EXISTING_FLOW"
        : "NOT_INDEPENDENTLY_VERIFIED",
  };
}

export async function GET() {
  try {
    const id = await currentUserId();
    if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await db();
    const user: any = await User.findById(id).select("name kyc").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json(safeAccountResponse(user), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: any) {
    console.error("Flutterwave account lookup failed:", error?.message || "unknown error");
    return NextResponse.json({ error: "Could not load Flutterwave account details." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let id: string | null = null;
  let txRef = "";

  try {
    id = await currentUserId();
    if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: "Flutterwave is not configured on the server." }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const nin = String(body?.nin || "").replace(/\s/g, "");
    if (!/^\d{11}$/.test(nin)) {
      return NextResponse.json({ error: "Enter a valid 11-digit NIN." }, { status: 400 });
    }

    await db();
    const user: any = await User.findById(id).select("name email phone phoneNumber kyc").lean();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Do not replace or migrate an existing Paystack account. Flutterwave is stored separately.
    if (user.kyc?.flutterwaveAccountNumber) {
      return NextResponse.json(safeAccountResponse(user));
    }

    if (user.kyc?.flutterwaveDvaStatus === "CREATING") {
      return NextResponse.json(
        { error: "Your Flutterwave account request is already processing. Refresh in a moment." },
        { status: 409 }
      );
    }

    const email = String(user.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Add an email address to your profile first." }, { status: 400 });

    const phone = String(user.phone || user.phoneNumber || "").trim();
    const names = String(user.name || "").trim().split(/\s+/).filter(Boolean);
    if (!names.length) return NextResponse.json({ error: "Add your full name to your profile first." }, { status: 400 });

    txRef = `DOZEN-FLW-${String(id)}-${randomUUID()}`;

    // Atomic guard prevents repeated clicks from making parallel account-creation requests.
    const locked: any = await User.findOneAndUpdate(
      {
        _id: id,
        "kyc.flutterwaveAccountNumber": { $in: [null, ""] },
        "kyc.flutterwaveDvaStatus": { $nin: ["CREATING"] },
      },
      {
        $set: {
          "kyc.flutterwaveTxRef": txRef,
          "kyc.flutterwaveDvaStatus": "CREATING",
        },
      },
      { new: true, runValidators: true }
    ).select("_id").lean();

    if (!locked) {
      const latest: any = await User.findById(id).select("name kyc").lean();
      if (latest?.kyc?.flutterwaveAccountNumber) return NextResponse.json(safeAccountResponse(latest));
      return NextResponse.json(
        { error: "An account request is already processing. Refresh in a moment and try again if no account appears." },
        { status: 409 }
      );
    }

    const response = await fetch("https://api.flutterwave.com/v3/virtual-account-numbers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        currency: "NGN",
        amount: 0,
        is_permanent: true,
        tx_ref: txRef,
        nin,
        firstname: names[0],
        lastname: names.slice(1).join(" ") || names[0],
        ...(phone ? { phonenumber: phone } : {}),
        bank_code: "090567",
      }),
      cache: "no-store",
    });

    const result: any = await response.json().catch(() => null);
    const account = result?.data;

    if (!response.ok || result?.status !== "success" || !account?.account_number) {
      await User.updateOne(
        { _id: id, "kyc.flutterwaveTxRef": txRef },
        { $set: { "kyc.flutterwaveDvaStatus": "FAILED" } }
      );
      // Do not log the request body, NIN, or the full provider response.
      console.error("Flutterwave static account creation failed:", {
        httpStatus: response.status,
        providerStatus: result?.status || "unknown",
        providerMessage: String(result?.message || "No provider message").slice(0, 200),
      });
      return NextResponse.json(
        { error: "Flutterwave could not create your permanent account. Check your details and try again." },
        { status: 502 }
      );
    }

    const updated: any = await User.findOneAndUpdate(
      { _id: id, "kyc.flutterwaveTxRef": txRef },
      {
        $set: {
          "kyc.flutterwaveAccountNumber": String(account.account_number),
          "kyc.flutterwaveBankName": String(account.bank_name || "Flutterwave MFB"),
          "kyc.flutterwaveAccountName": String(user.name || `${names[0]} ${names.slice(1).join(" ")}`.trim()),
          "kyc.flutterwaveReference": String(account.flw_ref || account.order_ref || ""),
          "kyc.flutterwaveDvaStatus": "ACTIVE",
          "kyc.flutterwaveCreatedAt": new Date(),
        },
      },
      { new: true, runValidators: true }
    ).select("name kyc").lean();

    if (!updated?.kyc?.flutterwaveAccountNumber) {
      console.error("Flutterwave account was created but could not be saved", { userId: String(id), txRef });
      return NextResponse.json(
        { error: "Flutterwave created the account, but Dozentelecom could not save it. Contact support before trying again." },
        { status: 500 }
      );
    }

    // Intentionally do NOT set kyc.status/type/verifiedAt. Account creation is not identity verification.
    return NextResponse.json(safeAccountResponse(updated));
  } catch (error: any) {
    if (id && txRef) {
      try {
        await db();
        await User.updateOne(
          { _id: id, "kyc.flutterwaveTxRef": txRef, "kyc.flutterwaveDvaStatus": "CREATING" },
          { $set: { "kyc.flutterwaveDvaStatus": "FAILED" } }
        );
      } catch {}
    }
    console.error("Flutterwave account creation error:", error?.message || "unknown error");
    return NextResponse.json({ error: "Unable to create your Flutterwave account right now." }, { status: 500 });
  }
}
