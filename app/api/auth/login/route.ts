
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { setSession } from "@/lib/session";
import { verify } from "@/lib/security";

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    const identifier = String(form.get("identifier") || "").trim();
    const password = String(form.get("password") || "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/phone and password are required." },
        { status: 400 }
      );
    }

    await db();

   const normalizedIdentifier = identifier.trim().toLowerCase();

const isEmail = normalizedIdentifier.includes("@");

const user = isEmail
  ? await User.findOne({
      email: normalizedIdentifier,
    })
  : await User.findOne({
      $or: [
        { phoneNumber: identifier.trim() },
        { phone: identifier.trim() },
      ],
    });

if (!user) {
  return NextResponse.json(
    {
      error: isEmail
        ? "This email address is not registered. Please create an account."
        : "This phone number is not registered. Please create an account.",
      code: "ACCOUNT_NOT_FOUND",
    },
    { status: 404 }
  );
}

if (user.blocked) {
  return NextResponse.json(
    {
      error: "Your account has been blocked. Contact support.",
      code: "ACCOUNT_BLOCKED",
    },
    { status: 403 }
  );
}

const validPassword = await verify(password, user.passwordHash);

if (!validPassword) {
  return NextResponse.json(
    {
      error: "Incorrect password. Please check your password and try again.",
      code: "WRONG_PASSWORD",
    },
    { status: 401 }
  );
}

    await setSession(String(user._id));

    const destination =
      user.role === "admin" ? "/admin" : "/dashboard";

    return NextResponse.json({
      success: true,
      redirect: destination,
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
