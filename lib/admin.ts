import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export async function requireAdmin() {
  const id = await currentUserId();

  if (!id) {
    redirect("/login");
  }

  await db();

  const user: any = await User.findById(id).lean();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return user;
}