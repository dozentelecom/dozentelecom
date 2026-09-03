import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function GET() {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  await db();

  const user: any =
    await User.findById(id)
      .select("kyc")
      .lean();

  if (!user) {
    return NextResponse.json(
      {
        error: "User not found",
      },
      {
        status: 404,
      }
    );
  }

  return NextResponse.json({
    success: true,

    kycStatus:
      user.kyc?.status || "PENDING",

    dvaStatus:
      user.kyc?.dvaStatus || null,

    accountNumber:
      user.kyc?.accountNumber || null,

    accountName:
      user.kyc?.accountName || null,

    bankName:
      user.kyc?.bankName || null,

    customerCode:
      user.kyc?.customerCode || null,
  });
}