
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { currentUserId } from "@/lib/session";

export default async function KycPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const id = await currentUserId();

  if (!id) redirect("/login");

  await db();

  const user: any = await User.findById(id)
    .select("kyc")
    .lean();

  // Flutterwave account already exists: no need to submit NIN again.
  if (
    user?.kyc?.flutterwaveAccountNumber &&
    user?.kyc?.flutterwaveDvaStatus === "ACTIVE"
  ) {
    redirect("/dashboard");
  }

  return (
    <main className="shell page">
      <div className="card auth-card">
        <h1>Set up your virtual accounts</h1>

        <p className="muted">
          Enter your NIN once. Flutterwave will process your details first.
          After Flutterwave successfully creates your account, Dozentelecom
          will automatically request your other available virtual accounts.
        </p>

        {params?.error && (
          <div className="alert error">{params.error}</div>
        )}

        <form action="/api/kyc/nin" method="post">
          <label className="label">11-digit NIN</label>

          <input
            className="input"
            name="nin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            autoComplete="off"
            required
          />

          <button type="submit" className="btn primary">
            Submit NIN and Create Accounts
          </button>
        </form>
      </div>
    </main>
  );
}
