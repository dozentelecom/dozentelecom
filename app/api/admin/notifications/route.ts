import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { Notification, User } from "@/lib/models";

const ALLOWED_TYPES = ["GENERAL", "ANNOUNCEMENT", "TRANSACTION", "FUNDING", "SECURITY", "PROMOTION"];

export async function POST(req: Request) {
  try {
    await requireAdminApi();
    await db();

    let body: any;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const { recipient, customerId, type, title, message, link, expiresAt } = body || {};
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Notification title is required." }, { status: 400 });
    }
    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Notification message is required." }, { status: 400 });
    }

    let userId: string | null = null;
    if (recipient === "CUSTOMER") {
      if (typeof customerId !== "string" || !customerId.trim()) {
        return NextResponse.json({ error: "Customer is required." }, { status: 400 });
      }
      const customer: any = await User.findById(customerId)
  .select("_id role")
  .lean();

if (!customer || customer.role === "admin") {
  return NextResponse.json(
    { error: "Customer not found." },
    { status: 404 }
  );
}
      userId = String(customer._id);
    }

    let parsedExpiry: Date | undefined;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (Number.isNaN(parsedExpiry.getTime())) {
        return NextResponse.json({ error: "Invalid expiration date." }, { status: 400 });
      }
    }

    const notification = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      type: ALLOWED_TYPES.includes(type) ? type : "GENERAL",
      read: false,
      link: typeof link === "string" ? link.trim() : "",
      ...(parsedExpiry ? { expiresAt: parsedExpiry } : {}),
    });

    return NextResponse.json({
      success: true,
      message: userId ? "Notification sent successfully." : "Notification sent to all customers.",
      notification,
    });
  } catch (error: unknown) {
    console.error("ADMIN NOTIFICATION CREATE ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unable to send notification." },
      { status }
    );
  }
}
