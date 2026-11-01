
import Link from "next/link";

export default async function VerifyCode({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const email = params?.email || "";

  return (
    <main className="shell page">
      <div className="card auth-card">
        <h1>Verify reset code</h1>

        <p className="muted">
          Enter the six-digit verification code sent to your email.
        </p>

        {params?.error && (
          <div className="alert error">{params.error}</div>
        )}

        <form action="/api/auth/verify-reset-code" method="post">
          <label className="label">Email</label>

          <input
            className="input"
            name="email"
            type="email"
            required
            defaultValue={email}
            placeholder="you@example.com"
          />

          <label className="label">Verification code</label>

          <input
            className="input"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            placeholder="123456"
          />

          <button className="btn primary" type="submit">
            Verify code
          </button>
        </form>

        <p>
          <Link href="/forgot-password">Request another recovery email</Link>
        </p>
      </div>
    </main>
  );
}
