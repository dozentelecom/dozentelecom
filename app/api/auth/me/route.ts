import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function GET() {
  try {
    const id = await currentUserId();

    if (!id) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    await db();

    const user: any = await User.findById(id)
      .select("name email role")
      .lean();

    if (!user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      name: user.name,
      email: user.email,
      role: user.role || "customer",
    });
  } catch (error) {
    console.error("ME API ERROR:", error);

    return NextResponse.json(
      { error: "Unable to load user information" },
      { status: 500 }
    );
  }
}