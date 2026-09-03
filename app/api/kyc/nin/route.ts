import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyNin } from "@/lib/provn";

export async function POST(req: Request) {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const ct = req.headers.get("content-type") || "";

    const body = ct.includes("form")
      ? Object.fromEntries((await req.formData()).entries())
      : await req.json();

    const nin = String((body as any).nin || "").replace(/\s/g, "");

    if (!/^\d{11}$/.test(nin)) {
      return NextResponse.redirect(
        new URL(
          "/kyc?error=Enter%20a%20valid%2011-digit%20NIN",
          req.url
        )
      );
    }

    // Verify with KYC provider
    const result = await verifyNin(nin);

    console.log("=== NIN PROVIDER RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

    await db();

// Save verified KYC information
const updatedUser = await User.findByIdAndUpdate(
  id,
  {
    $set: {
      "kyc.reference": nin,
      "kyc.status": "VERIFIED",
      "kyc.type": "NIN",
      "kyc.verifiedAt": new Date(),
    },
  },
  {
    new: true,
    runValidators: true,
  }
);

console.log("=== NIN KYC SAVED ===");
console.log({
  userId: String(id),
  foundUser: !!updatedUser,
  kycStatus: updatedUser?.kyc?.status,
  kycType: updatedUser?.kyc?.type,
  hasKycReference: !!updatedUser?.kyc?.reference,
});

if (!updatedUser) {
  throw new Error("User account could not be found.");
}

if (updatedUser.kyc?.status !== "VERIFIED") {
  throw new Error(
    "NIN verification succeeded, but the KYC status could not be saved."
  );
}

return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (error: any) {
    console.error("=== NIN KYC ERROR ===");
    console.error(error);

    return NextResponse.redirect(
      new URL(
        "/kyc?error=" +
          encodeURIComponent(
            error?.message || "NIN verification failed"
          ),
        req.url
      )
    );
  }
}