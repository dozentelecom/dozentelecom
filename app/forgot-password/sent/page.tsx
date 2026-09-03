import Link from "next/link";
export default async function Sent({searchParams}:{searchParams?:Promise<{method?:string}>}){
  const params=await searchParams; const m=params?.method||'both';
  return <main className="shell page"><div className="card auth-card"><h1>Check your email</h1><p className="muted">If the account exists, we sent your requested recovery option.</p>{(m==='code'||m==='both')&&<Link className="btn primary" href="/forgot-password/verify-code">I received a code</Link>} {(m==='link'||m==='both')&&<p className="muted">If you chose a link, open the secure reset link in your email.</p>}<p><Link href="/login">Return to login</Link></p></div></main>
}
