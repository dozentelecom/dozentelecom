import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "dt_session";

function secret() {
  const value = process.env.AUTH_SECRET;

  if (!value) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(value);
}

export async function setSession(id: string) {
  if (!id) {
    throw new Error("Invalid user ID.");
  }

  const token = await new SignJWT({ sub: id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());

  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function currentUserId() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string" || !payload.sub) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}