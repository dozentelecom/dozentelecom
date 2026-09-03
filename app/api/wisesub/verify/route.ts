import { NextResponse } from "next/server";
import { wisesub, WiseSubError } from "@/lib/wisesub";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const service_type = String(body?.service_type || "").trim();
    const provider_code = String(body?.provider_code || "").trim();

    if (!service_type) {
      return NextResponse.json(
        { success: false, error: "service_type is required" },
        { status: 400 }
      );
    }

    if (!provider_code) {
      return NextResponse.json(
        { success: false, error: "provider_code is required" },
        { status: 400 }
      );
    }

    // Electricity validation
    if (service_type === "electricity") {
      const meter_number = String(
        body?.meter_number || ""
      ).trim();

      const meter_type = String(
        body?.meter_type || ""
      ).trim();

      if (!meter_number) {
        return NextResponse.json(
          {
            success: false,
            error: "meter_number is required",
          },
          { status: 400 }
        );
      }

      if (!meter_type) {
        return NextResponse.json(
          {
            success: false,
            error: "meter_type is required",
          },
          { status: 400 }
        );
      }

      const result = await wisesub.verify({
        service_type: "electricity",
        provider_code,
        meter_number,
        meter_type,
      });

      return NextResponse.json(result);
    }

    // Cable TV validation
    if (service_type === "cabletv") {
      const decoder_number = String(
        body?.decoder_number || ""
      ).trim();

      if (!decoder_number) {
        return NextResponse.json(
          {
            success: false,
            error: "decoder_number is required",
          },
          { status: 400 }
        );
      }

      const result = await wisesub.verify({
        service_type: "cabletv",
        provider_code,
        decoder_number,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      {
        success: false,
        error: `Unsupported verification service: ${service_type}`,
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("WISESUB VERIFY ERROR:", error);

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
          "WiseSub verification failed",
      },
      { status: 500 }
    );
  }
}