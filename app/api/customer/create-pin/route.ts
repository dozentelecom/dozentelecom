import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { hash, validPin } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in again." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const pin = String(body.pin || "").trim();
    const confirm = String(body.confirm || "").trim();

    if (!validPin(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }

    if (pin !== confirm) {
      return NextResponse.json(
        { error: "PINs do not match." },
        { status: 400 }
      );
    }

    await db();

    const user: any = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    // IMPORTANT:
    // If a PIN already exists, never overwrite it.
    if (user.pinHash) {
      return NextResponse.json(
        {
          error: "Transaction PIN has already been created."
        },
        { status: 409 }
      );
    }

    const pinHash = await hash(pin);

    await User.findByIdAndUpdate(userId, {
      $set: {
        pinHash,
        pinCreatedAt: new Date(),
        failedPinAttempts: 0
      }
    });

    return NextResponse.json({
      success: true,
      message: "Transaction PIN created successfully."
    });

  } catch (error: any) {
    console.error("CREATE PIN ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to create transaction PIN."
      },
      { status: 500 }
    );
  }
}