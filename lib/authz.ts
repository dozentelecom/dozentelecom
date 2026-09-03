import {currentUserId} from "./session";
import {db} from "./db";
import {User} from "./models";
import {verify} from "./security";
export async function requireUser(){const id=await currentUserId();if(!id)throw new Error("UNAUTHORIZED");await db();const u=await User.findById(id);if(!u)throw new Error("UNAUTHORIZED");return u;}
export async function requirePin(pin:string){const u=await requireUser();if(!/^\d{4}$/.test(pin))throw new Error("Enter your 4-digit PIN");if(u.pinLockedUntil && new Date(u.pinLockedUntil).getTime()>Date.now())throw new Error("PIN temporarily locked. Try again later.");if(!u.pinHash)throw new Error("Transaction PIN has not been created");if(await verify(pin,u.pinHash)){await User.findByIdAndUpdate(u._id,{failedPinAttempts:0,pinLockedUntil:null});return u;}const n=(u.failedPinAttempts||0)+1;await User.findByIdAndUpdate(u._id,{failedPinAttempts:n,pinLockedUntil:n>=5?new Date(Date.now()+15*60000):null});throw new Error(n>=5?"PIN temporarily locked for 15 minutes":"Incorrect PIN");}
export function jsonAuthError(e:any){const m=e?.message||"Request failed";return m==="UNAUTHORIZED"?401:400;}
