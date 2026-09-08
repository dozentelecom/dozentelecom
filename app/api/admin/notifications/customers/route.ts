import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { currentUserId } from "@/lib/session";

async function requireAdminApi() {
  const id = await currentUserId();

  if (!id) {
    return null;
  }

  await db();

  const user: any = await User.findById(id).lean();

  if (!user || user.role !== "admin") {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const admin = await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await db();

    const customers = await User.find(
      { role: { $ne: "admin" } },
      {
        _id: 1,
        name: 1,
        email: 1,
        phone: 1,
      }
    )
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error: any) {
    console.error(
      "ADMIN NOTIFICATION CUSTOMERS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to load customers.",
      },
      { status: 500 }
    );
  }
}