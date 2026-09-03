import { NextResponse } from "next/server";
import {
  daltech,
  DaltechError,
} from "@/lib/daltech";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const service = String(
      searchParams.get("service") || ""
    ).trim();

    if (!service) {
      return NextResponse.json(
        {
          error: "service is required",
        },
        {
          status: 400,
        }
      );
    }

    const data = await daltech.services(service);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error(
      "DALTECH SERVICES ERROR:",
      error
    );

    if (error instanceof DaltechError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        {
          status:
            error.status >= 400 &&
            error.status <= 599
              ? error.status
              : 502,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to connect to Daltech",
      },
      {
        status: 502,
      }
    );
  }
}