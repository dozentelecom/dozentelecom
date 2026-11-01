import { NextResponse } from "next/server";
import { loadLegitdatawayDataPlans } from "@/lib/providers/legitdataway/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const type = new URL(request.url).searchParams.get("type") || "data";

  if (type !== "data") {
    return NextResponse.json(
      { success: false, error: "Only type=data is currently implemented." },
      { status: 400 },
    );
  }

  try {
    const result = await loadLegitdatawayDataPlans();

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(
      "Legitdataway catalogue error:",
      error instanceof Error ? error.message : "unknown error",
    );

    return NextResponse.json(
      {
        success: false,
        error: "Unable to load Legitdataway data plans.",
      },
      { status: 502 },
    );
  }
}
