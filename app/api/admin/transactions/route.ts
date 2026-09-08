// app/api/admin/transactions/route.ts

import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction, User } from "@/lib/models";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const admin: any = await User.findById(id)
    .select("role")
    .lean();

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

    const status =
      searchParams.get("status")?.trim() || "";

    const service =
      searchParams.get("service")?.trim() || "";

    const page = Math.max(
      Number(searchParams.get("page") || 1),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(searchParams.get("limit") || 50),
        1
      ),
      100
    );

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (service) {
      query.service = service;
    }

    if (search) {
      query.$or = [
        {
          externalReference: {
            $regex: search,
            $options: "i",
          },
        },
        {
          providerTransactionId: {
            $regex: search,
            $options: "i",
          },
        },
        {
          service: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total = await Transaction.countDocuments(
      query
    );

    const transactions: any[] =
      await Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const userIds = [
      ...new Set(
        transactions
          .map((tx) => tx.userId?.toString())
          .filter(Boolean)
      ),
    ];

    const users: any[] = userIds.length
      ? await User.find({
          _id: { $in: userIds },
        })
          .select(
            "name email phone phoneNumber vipLevel"
          )
          .lean()
      : [];

    const userMap = new Map(
      users.map((user) => [
        user._id.toString(),
        user,
      ])
    );

    const result = transactions.map((tx) => {
      const user = tx.userId
        ? userMap.get(tx.userId.toString())
        : null;

      return {
        ...tx,

        customer: user
          ? {
              id: user._id.toString(),
              name: user.name || "",
              email: user.email || "",
              phone:
                user.phone ||
                user.phoneNumber ||
                "",
              vipLevel:
                user.vipLevel || "NORMAL",
            }
          : null,
      };
    });

    return NextResponse.json({
      transactions: result,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error(
      "ADMIN TRANSACTIONS GET ERROR:",
      error
    );

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load transactions",
      },
      { status }
    );
  }
}