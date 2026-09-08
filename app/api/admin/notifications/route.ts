import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Notification, User } from "@/lib/models";
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

export async function POST(req: Request) {
  try {
    const admin = await requireAdminApi();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      recipient,
      customerId,
      type,
      title,
      message,
      link,
      expiresAt,
    } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Notification title is required." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Notification message is required." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "GENERAL",
      "ANNOUNCEMENT",
      "TRANSACTION",
      "FUNDING",
      "SECURITY",
      "PROMOTION",
    ];

    const notificationType = allowedTypes.includes(type)
      ? type
      : "GENERAL";

    await db();

    if (recipient === "CUSTOMER") {
      if (!customerId) {
        return NextResponse.json(
          { error: "Customer is required." },
          { status: 400 }
        );
      }

      const customer = await User.findById(customerId).lean();

      if (!customer) {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 }
        );
      }

      const notification = await Notification.create({
        userId: customerId,
        title: title.trim(),
        message: message.trim(),
        type: notificationType,
        read: false,
        link: typeof link === "string" ? link.trim() : "",
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      return NextResponse.json({
        success: true,
        message: "Notification sent successfully.",
        notification,
      });
    }

    const notification = await Notification.create({
      userId: null,
      title: title.trim(),
      message: message.trim(),
      type: notificationType,
      read: false,
      link: typeof link === "string" ? link.trim() : "",
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Notification sent to all customers.",
      notification,
    });
  } catch (error: any) {
    console.error(
      "ADMIN NOTIFICATION CREATE ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to send notification.",
      },
      { status: 500 }
    );
  }
}