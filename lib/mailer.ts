import {Resend} from "resend";
export async function sendMail(to:string,subject:string,html:string){
 const key=process.env.RESEND_API_KEY;if(!key)throw new Error("RESEND_API_KEY missing");
 return new Resend(key).emails.send({from:process.env.MAIL_FROM||"Dozentelecom <onboarding@resend.dev>",to:[to],subject,html});
}