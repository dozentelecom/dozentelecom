import {NextResponse} from "next/server";
import {db} from "@/lib/db";import {User} from "@/lib/models";import {randomToken,sha256,expiresIn} from "@/lib/tokens";import {sendMail} from "@/lib/mailer";
export async function POST(req:Request){
 const f=await req.formData();const email=String(f.get("email")||"").trim().toLowerCase();const method=String(f.get("method")||"both");
 if(!email)return NextResponse.redirect(new URL("/forgot-password?error=Enter%20your%20email",req.url));
 await db();const u:any=await User.findOne({email});
 if(u){
  const linkToken=randomToken(32),code=String(Math.floor(100000+Math.random()*900000));
  await User.findByIdAndUpdate(u._id,{resetPasswordTokenHash:sha256(linkToken),resetPasswordExpires:expiresIn(30),resetPasswordCodeHash:sha256(code),resetPasswordCodeExpires:expiresIn(15)});
  const base=process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin;
  const link=`${base}/reset-password?token=${linkToken}`;
  const includeLink=method==='link'||method==='both';const includeCode=method==='code'||method==='both';
  const parts=[`<p>Your Dozentelecom password reset request is valid for 30 minutes.</p>`];
  if(includeCode) parts.push(`<p><b>Verification code:</b> ${code}</p><p>The code expires in 15 minutes.</p>`);
  if(includeLink) parts.push(`<p><a href="${link}">Reset your password securely</a></p><p>If the button does not work, use: ${link}</p>`);
  await sendMail(u.email,"Dozentelecom password reset",parts.join(""));
 }
 return NextResponse.redirect(new URL(`/forgot-password/sent?method=${encodeURIComponent(method)}`,req.url));
}
