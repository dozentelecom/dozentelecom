import Link from "next/link";
export default async function ResetPassword({searchParams}:{searchParams?:Promise<{token?:string;error?:string}>}){
  const params=await searchParams; const token=params?.token||'';
  return <main className="shell page"><div className="card auth-card"><h1>Create a new password</h1><p className="muted">Choose a new password, confirm it, and you will be returned to login after success.</p>{params?.error&&<div className="alert error">{params.error}</div>}<form action="/api/auth/reset-password" method="post"><input type="hidden" name="token" value={token}/><label className="label">New password</label><input className="input" name="password" type="password" minLength={8} required/><label className="label">Confirm new password</label><input className="input" name="confirm" type="password" minLength={8} required/><button className="btn primary">Reset password</button></form><p><Link href="/login">Back to login</Link></p></div></main>
}
