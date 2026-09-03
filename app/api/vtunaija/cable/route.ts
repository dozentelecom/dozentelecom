import { NextResponse } from "next/server";

export async function GET() {
  try {
    const base = (
      process.env.VTUNAIJA_BASE_URL ||
      "https://sandbox.vtunaija.com.ng/api"
    ).replace(/\/+$/, "");

    const key = process.env.VTUNAIJA_API_KEY || "";

    if (!key) {
      return NextResponse.json(
        { error: "VTUNAIJA_API_KEY is missing" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${base}/listcabletvplans/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      }
    );

    const text = await response.text();

    let json: any;

    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Invalid VTUNAIJA response", raw: text },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        json,
        { status: response.status }
      );
    }

    return NextResponse.json(json);

  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to connect to VTUNAIJA",
      },
      { status: 502 }
    );
  }
}