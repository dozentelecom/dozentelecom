import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import AdminSidebar from "@/components/admin/AdminSidebar";
import CustomerEmailsClient from "./CustomerEmailsClient";

export const dynamic = "force-dynamic";

export default async function CustomerEmailsPage() {
  await requireAdmin();
  await db();

  const users = await User.find(
    {
      email: {
        $exists: true,
        $ne: "",
      },
    },
    {
      email: 1,
    }
  )
    .sort({ email: 1 })
    .lean();

  const emails = Array.from(
    new Set(
      users
        .map((user: any) =>
          String(user.email || "")
            .trim()
            .toLowerCase()
        )
        .filter(
          (email: string) => email.length > 0
        )
    )
  );

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <div className="admin-dashboard-top">
          <div>
            <div className="eyebrow">
              ADMINISTRATION
            </div>

            <h1>Customer Emails</h1>

            <p className="muted">
              View and copy registered customer
              email addresses.
            </p>
          </div>
        </div>

        <CustomerEmailsClient
          emails={emails}
        />
      </main>
    </div>
  );
}
