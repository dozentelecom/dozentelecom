
import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userId = await currentUserId();

  if (!userId) {
    redirect("/login");
  }

  await db();

  const user: any = await User.findById(userId)
  .select("role blocked")
  .lean();

if (!user || user.blocked || user.role !== "admin") {
  notFound();
}

  return <>{children}</>;
}
