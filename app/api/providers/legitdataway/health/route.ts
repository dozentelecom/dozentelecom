import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.LEGITDATAWAY_BASE_URL ||
      "https://legitdataway.com/api";

    const username =
      process.env.LEGITDATAWAY_USERNAME;

    const password =
      process.env.LEGITDATAWAY_PASSWORD;

    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Legitdataway credentials are not configured",
        },
        { status: 500 }
      );
    }

    const basic = Buffer.from(
      `${username}:${password}`
    ).toString("base64");

    const response = await fetch(
      `${baseUrl}/user`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok || data?.status !== "success") {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.message ||
            data?.response ||
            "Legitdataway authentication failed",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      provider: "LEGITDATAWAY",
      authenticated: true,
      balance:
        data?.balance ?? null,
      username:
        data?.username ?? null,
    });
  } catch (error: any) {
    console.error(
      "LEGITDATAWAY HEALTH ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Legitdataway connection failed",
      },
      { status: 500 }
    );
  }
}