
import { Resend } from "resend";

export async function sendMail(
  to: string,
  subject: string,
  html: string
) {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    throw new Error("RESEND_API_KEY is missing");
  }

  const from = process.env.MAIL_FROM;

  if (!from) {
    throw new Error("MAIL_FROM is missing");
  }

  const resend = new Resend(key);

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("RESEND EMAIL ERROR:", error);
    throw new Error(error.message || "Email delivery request failed");
  }

  if (!data?.id) {
    throw new Error("Resend did not return an email ID");
  }

  console.log("Recovery email accepted by Resend:", data.id);

  return data;
}
