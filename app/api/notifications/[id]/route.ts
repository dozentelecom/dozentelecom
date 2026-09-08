import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Notification } from "@/lib/models";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(
  req: Request,
  context: RouteContext
) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    await db();

    /*
     * A customer can only mark:
     *
     * 1. Their own notification
     * 2. A global notification
     *
     * as read.
     */
    const notification =
      await Notification.findOneAndUpdate(
        {
          _id: id,

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
          $set: {
            read: true,
          },
        },
        {
          new: true,
        }
      ).lean();

    if (!notification) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,

      notification: {
        id: String(notification._id),

        title: notification.title,

        message: notification.message,

        type: notification.type,

        read: true,

        link: notification.link || "",

        createdAt:
          notification.createdAt,
      },
    });
  } catch (error: any) {
    console.error(
      "MARK NOTIFICATION READ ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Unable to mark notification as read.",
      },
      {
        status: 500,
      }
    );
  }
}