
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

/**
 * Throws UNAUTHORIZED when there is no session and FORBIDDEN when the
 * session does not belong to an active administrator.
 * Returns the authenticated administrator's user ID.
 */
export async function requireAdminApi(): Promise<string> {
  const id = await currentUserId();

  if (!id) {
    throw new Error("UNAUTHORIZED");
  }

  await db();

  const user: any = await User.findById(id)
    .select("blocked role")
    .lean()
    .exec();

  if (!user || user.blocked === true || user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return String(id);
}

export function adminApiErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") return 401;
  if (message === "FORBIDDEN") return 403;

  return 500;
}
