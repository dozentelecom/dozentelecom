import crypto from "crypto";
export const randomToken=(n=32)=>crypto.randomBytes(n).toString("hex");
export const sha256=(v:string)=>crypto.createHash("sha256").update(v).digest("hex");
export const expiresIn=(m:number)=>new Date(Date.now()+m*60000);