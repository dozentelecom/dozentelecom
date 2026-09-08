import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  AuditLog,
  User,
} from "@/lib/models";

export const dynamic =
  "force-dynamic";

export async function GET(
  req: Request
) {
  try {
    const adminId =
      await requireAdmin();

    await db();

    const {
      searchParams,
    } = new URL(req.url);

    const search =
      searchParams
        .get("search")
        ?.trim() || "";

    const action =
      searchParams
        .get("action")
        ?.trim() || "";

    const targetType =
      searchParams
        .get("targetType")
        ?.trim() || "";

    const page = Math.max(
      Number(
        searchParams.get(
          "page"
        ) || 1
      ),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(
          searchParams.get(
            "limit"
          ) || 25
        ),
        1
      ),
      100
    );

    const query: any = {};

    if (action) {
      query.action = action;
    }

    if (targetType) {
      query.targetType =
        targetType;
    }

    if (search) {
      query.$or = [
        {
          action: {
            $regex: search,
            $options: "i",
          },
        },
        {
          description: {
            $regex: search,
            $options: "i",
          },
        },
        {
          targetId: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total =
      await AuditLog.countDocuments(
        query
      );

    const logs: any[] =
      await AuditLog.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(
          (page - 1) *
            limit
        )
        .limit(limit)
        .lean();

    const adminIds = [
      ...new Set(
        logs
          .map((log) =>
            log.adminId
              ?.toString()
          )
          .filter(Boolean)
      ),
    ];

    const admins: any[] =
      adminIds.length
        ? await User.find({
            _id: {
              $in: adminIds,
            },
          })
            .select(
              "name email role"
            )
            .lean()
        : [];

    const adminMap =
      new Map(
        admins.map(
          (admin) => [
            admin._id.toString(),
            admin,
          ]
        )
      );

    const result =
      logs.map((log) => {
        const admin =
          log.adminId
            ? adminMap.get(
                log.adminId.toString()
              )
            : null;

        return {
          id: log._id.toString(),

          action:
            log.action,

          targetType:
            log.targetType,

          targetId:
            log.targetId ||
            null,

          description:
            log.description,

          previousValue:
            log.previousValue ??
            null,

          newValue:
            log.newValue ??
            null,

          ipAddress:
            log.ipAddress ||
            null,

          userAgent:
            log.userAgent ||
            null,

          metadata:
            log.metadata ||
            null,

          createdAt:
            log.createdAt ||
            null,

          admin: admin
            ? {
                id: admin._id.toString(),
                name:
                  admin.name ||
                  "",
                email:
                  admin.email ||
                  "",
                role:
                  admin.role ||
                  "admin",
              }
            : null,
        };
      });

    return NextResponse.json({
      logs: result,

      pagination: {
        page,

        limit,

        total,

        totalPages:
          Math.ceil(
            total / limit
          ),
      },

      currentAdminId:
        adminId,
    });
  } catch (error: any) {
    console.error(
      "ADMIN AUDIT LOGS ERROR:",
      error
    );

    const message =
      error?.message ||
      "";

    const status =
      message ===
      "UNAUTHORIZED"
        ? 401
        : message ===
          "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        error:
          message ||
          "Unable to load audit logs",
      },
      {
        status,
      }
    );
  }
}