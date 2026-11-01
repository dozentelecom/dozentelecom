
import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      console.error(
        "CUSTOMER LAYOUT: No valid session ID found."
      );
      redirect("/login");
    }

    await db();

    const user: any = await User.findById(userId)
  .select("blocked role")
  .lean();

    if (!user) {
      console.error(
        "CUSTOMER LAYOUT: Session user does not exist:",
        userId
      );
      redirect("/login");
    }

    if (user.blocked) {
      console.error(
        "CUSTOMER LAYOUT: Customer account is blocked:",
        userId
      );
      redirect("/login");
    }

    if (user.role === "admin") {
      console.log(
        "CUSTOMER LAYOUT: Admin attempted to access customer dashboard."
      );
      redirect("/admin");
    }

    return <>{children}</>;
  } catch (error) {
    // Next.js redirect() throws an internal redirect signal.
    // It must not be swallowed by this catch.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof error.digest === "string" &&
      error.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("CUSTOMER LAYOUT ERROR:", error);

    throw error;
  }
}
