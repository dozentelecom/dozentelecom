import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApi();
    await db();

    const customers = await User.find({ role: { $ne: "admin" } }, {
      _id: 1, name: 1, email: 1, phone: 1, phoneNumber: 1,
    }).sort({ name: 1 }).lean();

    return NextResponse.json({
      success: true,
      customers: customers.map((customer: any) => ({
        ...customer,
        phone: customer.phone || customer.phoneNumber || "",
      })),
    });
  } catch (error: unknown) {
    console.error("ADMIN NOTIFICATION CUSTOMERS ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? "Unauthorized" : status === 403 ? "Forbidden" : "Unable to load customers." },
      { status }
    );
  }
}
