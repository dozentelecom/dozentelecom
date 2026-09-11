import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyNin, verifyBvn } from "@/lib/provn";

export async function POST(req: Request) {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const form = await req.formData();

    const type = String(form.get("type") || "").toLowerCase();
    const number = String(form.get("number") || "").replace(/\s/g, "");

    if (!["nin", "bvn"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid KYC type" },
        { status: 400 }
      );
    }

    if (!/^[0-9]{11}$/.test(number)) {
      return NextResponse.json(
        { error: "KYC number must be exactly 11 digits" },
        { status: 400 }
      );
    }

    // Use the same PROVN provider implementation
    // for both NIN and BVN.
    const result =
      type === "nin"
        ? await verifyNin(number)
        : await verifyBvn(number);

    console.log("=== PROVN KYC RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

    await db();

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          "kyc.status": "VERIFIED",
          "kyc.type": type.toUpperCase(),
          "kyc.reference": String(
            result?.data?.nin ||
              result?.data?.bvn ||
              number
          ),
          "kyc.verifiedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      throw new Error("User account could not be found.");
    }

    if (updatedUser.kyc?.status !== "VERIFIED") {
      throw new Error(
        "KYC verification succeeded, but the KYC status could not be saved."
      );
    }

    return NextResponse.redirect(
      new URL("/dashboard", req.url)
    );
  } catch (error: any) {
    console.error("=== KYC VERIFICATION ERROR ===");
    console.error(error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "KYC verification failed",
      },
      {
        status: 400,
      }
    );
  }
}