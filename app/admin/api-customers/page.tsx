import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ApiCustomer } from "@/lib/models";
import AdminSidebar from "@/components/admin/AdminSidebar";
import ApiCustomersClient from "./ApiCustomersClient";

export const dynamic = "force-dynamic";

export default async function ApiCustomersPage() {
  await requireAdmin();
  await db();

  const customers = await ApiCustomer.find({})
    .sort({ createdAt: -1 })
    .lean();

  const data = customers.map((customer: any) => ({
    id: customer._id.toString(),
    name: customer.name,
    email: customer.email,
    companyName: customer.companyName || "",
    status: customer.status,
    balanceKobo: customer.balanceKobo || 0,
    testApiKeyPrefix: customer.testApiKeyPrefix || "",
    liveApiKeyPrefix: customer.liveApiKeyPrefix || "",
    services: customer.services || {},
    createdAt: customer.createdAt
      ? new Date(customer.createdAt).toISOString()
      : null,
  }));

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <div className="admin-dashboard-top">
          <div>
            <div className="eyebrow">
              API MANAGEMENT
            </div>

            <h1>API Customers</h1>

            <p className="muted">
              Create and manage websites and businesses
              connected to the Dozentelecom API.
            </p>
          </div>
        </div>

        <ApiCustomersClient customers={data} />
      </main>
    </div>
  );
  }
