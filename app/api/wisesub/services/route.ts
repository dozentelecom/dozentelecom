import { NextResponse } from "next/server";
import {
  wisesub,
  WiseSubError,
} from "@/lib/wisesub";

export async function GET() {
  try {
    const result = await wisesub.services();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("WISESUB SERVICES ERROR:", error);

    const status =
      error instanceof WiseSubError
        ? error.status
        : 502;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to connect to WiseSub",
        details:
          error instanceof WiseSubError
            ? error.details
            : undefined,
      },
      { status }
    );
  }
}