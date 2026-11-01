
import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import {
  randomToken,
  sha256,
  expiresIn,
} from "@/lib/tokens";
import { sendMail } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    const f = await req.formData();

    const email = String(f.get("email") || "")
      .trim()
      .toLowerCase();

    const requestedMethod = String(f.get("method") || "both");
    const method = ["code", "link", "both"].includes(requestedMethod)
      ? requestedMethod
      : "both";

    if (!email) {
      return NextResponse.redirect(
        new URL("/forgot-password?error=Enter%20your%20email", req.url),
        303
      );
    }

    await db();

    const user: any = await User.findOne({ email });

    if (user) {
      const includeCode = method === "code" || method === "both";
      const includeLink = method === "link" || method === "both";

      const updates: Record<string, any> = {};

      let code = "";
      let linkToken = "";

      if (includeCode) {
        code = String(randomInt(100000, 1000000));
        updates.resetPasswordCodeHash = sha256(code);
        updates.resetPasswordCodeExpires = expiresIn(15);
      } else {
        updates.$unset = {
          resetPasswordCodeHash: 1,
          resetPasswordCodeExpires: 1,
        };
      }

      if (includeLink) {
        linkToken = randomToken(32);
        updates.resetPasswordTokenHash = sha256(linkToken);
        updates.resetPasswordExpires = expiresIn(30);
      } else {
        updates.$unset = {
          ...updates.$unset,
          resetPasswordTokenHash: 1,
          resetPasswordExpires: 1,
        };
      }

      await User.findByIdAndUpdate(user._id, updates);

      const base = (
        process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
      ).replace(/\/$/, "");

      const parts = [
        "<p>Your Dozentelecom password recovery request was received.</p>",
      ];

      if (includeCode) {
        parts.push(
          `<p>Your six-digit verification code is:</p>
           <h2 style="letter-spacing:5px">${code}</h2>
           <p>This code expires in 15 minutes. Do not share it with anyone.</p>`
        );
      }

      if (includeLink) {
        const link = `${base}/reset-password?token=${encodeURIComponent(linkToken)}`;

        parts.push(
          `<p><a href="${link}">Reset your password securely</a></p>
           <p>This reset link expires in 30 minutes.</p>`
        );
      }

      await sendMail(
        user.email,
        "Dozentelecom password recovery",
        parts.join("")
      );
    }

    // If a code was requested, take the customer directly to code entry.
    if (method === "code" || method === "both") {
      return NextResponse.redirect(
        new URL(
          `/forgot-password/verify-code?email=${encodeURIComponent(email)}`,
          req.url
        ),
        303
      );
    }

    return NextResponse.redirect(
      new URL("/forgot-password/sent?method=link", req.url),
      303
    );
  } catch (error) {
    console.error("FORGOT PASSWORD EMAIL ERROR:", error);

    return NextResponse.redirect(
      new URL(
        "/forgot-password?error=Unable%20to%20send%20recovery%20email.%20Please%20try%20again.",
        req.url
      ),
      303
    );
  }
}
