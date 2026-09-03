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

  if (!id) {
    redirect("/login");
  }

  await db();

  const u: any = await User.findById(id).lean();

  console.log("=================================");
  console.log("=== KYC PAGE USER CHECK ===");
  console.log("=================================");
  console.log("USER ID:", String(id));
  console.log("USER EXISTS:", !!u);
  console.log("USER EMAIL:", u?.email);
  console.log("USER NAME:", u?.name);
  console.log("FULL KYC OBJECT:", u?.kyc);
  console.log("KYC STATUS:", u?.kyc?.status);
  console.log("KYC TYPE:", u?.kyc?.type);
  console.log("KYC REFERENCE EXISTS:", !!u?.kyc?.reference);
  console.log("=================================");

  if (u?.kyc?.status === "VERIFIED") {
    redirect("/dashboard");
  }

  return (
    <main className="shell page">
      <div className="card auth-card">
        <h1>Verify your identity</h1>

        <p className="muted">
          Complete NIN or BVN verification once. After successful
          verification this page disappears for your account.
        </p>

        {params?.error && (
          <div className="alert error">
            {params.error}
          </div>
        )}

        <form action="/api/kyc/nin" method="post">
          <label className="label">NIN</label>

          <input
            className="input"
            name="nin"
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            required
          />

          <button type="submit" className="btn primary">
            Verify NIN
          </button>
        </form>

        <hr />

        <form action="/api/kyc/bvn" method="post">
          <label className="label">BVN</label>

          <input
            className="input"
            name="bvn"
            inputMode="numeric"
            pattern="[0-9]{11}"
            maxLength={11}
            required
          />

          <button type="submit" className="btn primary">
            Verify BVN
          </button>
        </form>
      </div>
    </main>
  );
}