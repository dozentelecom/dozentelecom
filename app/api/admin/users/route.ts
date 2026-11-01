import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdminApi();
    await db();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const vipLevel = searchParams.get("vipLevel")?.trim() || "";
    const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 25) || 25));

    const query: any = { role: { $ne: "admin" } };
    if (vipLevel) query.vipLevel = vipLevel;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
        { phoneNumber: { $regex: escaped, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);
    const users: any[] = await User.find(query)
      .select("name email phone phoneNumber role vipLevel blocked kyc createdAt")
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec();

    const userIds = users.map((user) => user._id);
    const wallets: any[] = userIds.length
      ? await Wallet.find({ userId: { $in: userIds } }).select("userId balanceKobo currency").lean().exec()
      : [];
    const walletMap = new Map(wallets.map((wallet) => [wallet.userId.toString(), wallet]));

    const result = users.map((user) => {
      const wallet = walletMap.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || user.phoneNumber || "",
        role: user.role || "customer",
        vipLevel: user.vipLevel || "NORMAL",
        blocked: user.blocked === true,
        kycStatus: user.kyc?.status || "PENDING",
        kycType: user.kyc?.type || "",
        createdAt: user.createdAt || null,
        wallet: { balanceKobo: Number(wallet?.balanceKobo || 0), currency: wallet?.currency || "NGN" },
      };
    });

    return NextResponse.json({
      success: true,
      users: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    console.error("ADMIN USERS GET ERROR:", error);
    const status = adminApiErrorStatus(error);
    return NextResponse.json({
      success: false,
      error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load customers",
    }, { status });
  }
}
