import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Notification } from "@/lib/models";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          notifications: [],
          unreadCount: 0,
        },
        {
          status: 401,
        }
      );
    }

    await db();

    const now = new Date();

    /*
     * Customer receives:
     *
     * 1. Notifications specifically sent to them
     * 2. Global notifications where userId is null
     *
     * Expired notifications are excluded.
     */
    const notifications =
      await Notification.find({
        $and: [
          {
            $or: [
              {
                userId,
              },
              {
                userId: null,
              },
            ],
          },
          {
            $or: [
              {
                expiresAt: {
                  $exists: false,
                },
              },
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  $gt: now,
                },
              },
            ],
          },
        ],
      })
        .sort({
          createdAt: -1,
        })
        .limit(50)
        .lean();

    const unreadCount =
      await Notification.countDocuments({
        $and: [
          {
            $or: [
              {
                userId,
              },
              {
                userId: null,
              },
            ],
          },
          {
            read: false,
          },
          {
            $or: [
              {
                expiresAt: {
                  $exists: false,
                },
              },
              {
                expiresAt: null,
              },
              {
                expiresAt: {
                  $gt: now,
                },
              },
            ],
          },
        ],
      });

    return NextResponse.json({
      success: true,

      notifications: notifications.map(
        (notification: any) => ({
          id: String(notification._id),

          title: notification.title,

          message: notification.message,

          type: notification.type,

          read: Boolean(notification.read),

          link: notification.link || "",

          createdAt:
            notification.createdAt,

          expiresAt:
            notification.expiresAt || null,
        })
      ),

      unreadCount,
    });
  } catch (error: any) {
    console.error(
      "CUSTOMER NOTIFICATIONS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to load notifications.",

        notifications: [],

        unreadCount: 0,
      },
      {
        status: 500,
      }
    );
  }
}