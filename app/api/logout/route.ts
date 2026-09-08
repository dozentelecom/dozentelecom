import { NextResponse } from "next/server";

import { clearSession } from "@/lib/session";

export async function POST() {
  try {
    await clearSession();

    return NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error(
      "LOGOUT ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Unable to logout.",
      },
      { status: 500 }
    );
  }
}