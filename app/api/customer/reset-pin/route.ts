import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { hash, verify } from "@/lib/security";
import { validPin } from "@/lib/security";

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

    const oldPin = String(body.oldPin || "").trim();
    const newPin = String(body.newPin || "").trim();

    if (!validPin(oldPin)) {
      return NextResponse.json(
        { error: "Current PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }

    if (!validPin(newPin)) {
      return NextResponse.json(
        { error: "New PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }

    if (oldPin === newPin) {
      return NextResponse.json(
        { error: "New PIN must be different from your current PIN." },
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

    if (!user.pinHash) {
      return NextResponse.json(
        {
          error:
            "You do not have a transaction PIN yet. Please create a PIN first."
        },
        { status: 400 }
      );
    }

    const correct = await verify(oldPin, user.pinHash);

    if (!correct) {
      return NextResponse.json(
        { error: "Current PIN is incorrect." },
        { status: 400 }
      );
    }

    const newPinHash = await hash(newPin);

    await User.findByIdAndUpdate(userId, {
      $set: {
        pinHash: newPinHash,
        pinCreatedAt: new Date(),
        failedPinAttempts: 0
      },
      $unset: {
        pinLockedUntil: 1
      }
    });

    return NextResponse.json({
      success: true,
      message: "Transaction PIN changed successfully."
    });
  } catch (error: any) {
    console.error("CUSTOMER RESET PIN ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unable to reset PIN."
      },
      { status: 500 }
    );
  }
}