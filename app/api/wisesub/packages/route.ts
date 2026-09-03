import { NextResponse } from "next/server";
import { wisesub, WiseSubError } from "@/lib/wisesub";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const service_type =
      searchParams.get("service_type")?.trim() || "";

    const provider_code =
      searchParams.get("provider_code")?.trim() || "";

    if (!service_type) {
      return NextResponse.json(
        {
          success: false,
          error: "service_type is required",
        },
        { status: 400 }
      );
    }

    if (!provider_code) {
      return NextResponse.json(
        {
          success: false,
          error: "provider_code is required",
        },
        { status: 400 }
      );
    }

    const result = await wisesub.packages(
      service_type,
      provider_code
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WISESUB PACKAGES ERROR:", error);

    if (error instanceof WiseSubError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          details: error.details,
        },
        {
          status: error.status || 502,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Unable to load WiseSub packages",
      },
      { status: 500 }
    );
  }
}