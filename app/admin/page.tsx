import { requireAdmin } from "@/lib/admin";
import AdminSidebar from "@/components/admin/AdminSidebar";
import BackButton from "@/components/admin/BackButton";

export default async function AdminDashboard() {
  const admin = await requireAdmin();

  return (
    <div className="admin-dashboard-layout">
      <AdminSidebar />

      <main className="admin-dashboard-content">
        <div className="admin-dashboard-top">
          <div>
            <div className="eyebrow">
              ADMINISTRATION
            </div>

            <h1>Admin Dashboard</h1>

            <p className="muted">
              Welcome back, {admin.name}.
            </p>
          </div>
        </div>

        <div className="admin-stat-grid">

          <div className="card">
            <div className="muted">
              Customers
            </div>

            <h2>0</h2>

            <p className="muted">
              Registered customers
            </p>
          </div>

          <div className="card">
            <div className="muted">
              Transactions
            </div>

            <h2>0</h2>

            <p className="muted">
              Total transactions
            </p>
          </div>

          <div className="card">
            <div className="muted">
              Wallet Funding
            </div>

            <h2>₦0.00</h2>

            <p className="muted">
              Total funding
            </p>
          </div>

          <div className="card">
            <div className="muted">
              Profit
            </div>

            <h2>₦0.00</h2>

            <p className="muted">
              Total estimated profit
            </p>
          </div>

        </div>

        <div className="admin-quick-grid">

          <a
            href="/admin/customers"
            className="card admin-quick-card"
          >
            <h3>👥 Customers</h3>
            <p className="muted">
              Manage registered customers.
            </p>
          </a>

          <a
            href="/admin/transactions"
            className="card admin-quick-card"
          >
            <h3>💳 Transactions</h3>
            <p className="muted">
              View customer transactions.
            </p>
          </a>

          <a
            href="/admin/settings"
            className="card admin-quick-card"
          >
            <h3>💰 Pricing & Rates</h3>
            <p className="muted">
              Control service pricing and
              funding rates.
            </p>
          </a>

        </div>
      </main>
    </div>
  );
}