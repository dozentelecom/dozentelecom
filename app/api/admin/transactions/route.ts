import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { Transaction, User } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdminApi();
    await db();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const service = searchParams.get("service")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50) || 50));

    const query: any = {};
    if (status) query.status = status;
    if (service) query.service = service;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { externalReference: { $regex: escaped, $options: "i" } },
        { providerTransactionId: { $regex: escaped, $options: "i" } },
        { service: { $regex: escaped, $options: "i" } },
      ];
    }

    const total = await Transaction.countDocuments(query);
    const transactions: any[] = await Transaction.find(query)
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();

    const userIds = [...new Set(transactions.map((tx) => tx.userId?.toString()).filter(Boolean))];
    const users: any[] = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select("name email phone phoneNumber vipLevel").lean()
      : [];
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const result = transactions.map((tx) => {
      const user = tx.userId ? userMap.get(tx.userId.toString()) : null;
      return {
        ...tx,
        customer: user ? {
          id: user._id.toString(),
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || user.phoneNumber || "",
          vipLevel: user.vipLevel || "NORMAL",
        } : null,
      };
    });

    return NextResponse.json({
      transactions: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    console.error("ADMIN TRANSACTIONS GET ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({ error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load transactions" }, { status });
  }
}
