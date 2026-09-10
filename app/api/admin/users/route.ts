import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User, Wallet } from "@/lib/models";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const admin: any = await User.findById(id)
    .select("role")
    .lean()
    .exec();

  if (!admin || admin.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return id;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);

    const search =
      searchParams.get("search")?.trim() || "";

    const vipLevel =
      searchParams.get("vipLevel")?.trim() || "";

    const page = Math.max(
      Number(searchParams.get("page") || 1),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(searchParams.get("limit") || 25),
        1
      ),
      100
    );

    const query: any = {
      role: { $ne: "admin" },
    };

    if (vipLevel) {
      query.vipLevel = vipLevel;
    }

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phone: {
            $regex: search,
            $options: "i",
          },
        },
        {
          phoneNumber: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total =
      await User.countDocuments(query);

    const users: any[] =
      await User.find(query)
        .select(
          "name email phone phoneNumber role vipLevel blocked kyc createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec();

    const userIds = users.map(
      (user) => user._id
    );

    const wallets: any[] =
      userIds.length
        ? await Wallet.find({
            userId: {
              $in: userIds,
            },
          })
            .select(
              "userId balanceKobo currency"
            )
            .lean()
            .exec()
        : [];

    const walletMap = new Map(
      wallets.map((wallet) => [
        wallet.userId.toString(),
        wallet,
      ])
    );

    const result = users.map(
      (user) => {
        const wallet =
          walletMap.get(
            user._id.toString()
          );

        return {
          id: user._id.toString(),

          name: user.name || "",

          email: user.email || "",

          phone:
            user.phone ||
            user.phoneNumber ||
            "",

          role:
            user.role ||
            "customer",

          vipLevel:
            user.vipLevel ||
            "NORMAL",

          blocked:
            user.blocked === true,

          kycStatus:
            user.kyc?.status ||
            "PENDING",

          kycType:
            user.kyc?.type || "",

          createdAt:
            user.createdAt || null,

          wallet: {
            balanceKobo:
              Number(
                wallet?.balanceKobo ||
                  0
              ),

            currency:
              wallet?.currency ||
              "NGN",
          },
        };
      }
    );

    return NextResponse.json({
      success: true,
      users: result,

      pagination: {
        page,
        limit,
        total,
        totalPages:
          Math.ceil(
            total / limit
          ),
      },
    });
  } catch (error: any) {
    console.error(
      "ADMIN USERS GET ERROR:",
      error
    );

    const status =
      error?.message ===
      "UNAUTHORIZED"
        ? 401
        : error?.message ===
          "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to load customers",
      },
      { status }
    );
  }
}