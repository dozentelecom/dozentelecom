import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    await db();

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer ID is required",
        },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (typeof body.blocked !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "blocked must be a boolean",
        },
        { status: 400 }
      );
    }

    const user = await User.findById(id).select("role blocked");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found",
        },
        { status: 404 }
      );
    }

    // Never allow an admin account to be blocked through this endpoint.
    if (user.role === "admin") {
      return NextResponse.json(
        {
          success: false,
          message: "Admin accounts cannot be blocked",
        },
        { status: 403 }
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          blocked: body.blocked,
        },
      },
      {
        new: true,
      }
    ).select("_id blocked");

    return NextResponse.json({
      success: true,
      customer: {
        id: String(updatedUser?._id),
        blocked: updatedUser?.blocked === true,
      },
    });
  } catch (error) {
    console.error("ADMIN BLOCK CUSTOMER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update customer status",
      },
      { status: 500 }
    );
  }
}