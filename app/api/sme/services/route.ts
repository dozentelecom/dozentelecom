import { NextResponse } from "next/server";
import {
  smeapi,
  normalizeCatalog,
  ProviderError,
} from "@/lib/smeapi";

export async function GET() {
  try {
    console.log("=================================");
    console.log("SME CATALOG REQUEST");
    console.log("GET /catalog/");
    console.log("=================================");

    const raw = await smeapi.catalog();

    console.log(
      "SME CATALOG RAW RESPONSE:",
      JSON.stringify(raw, null, 2)
    );

    const catalog =
      normalizeCatalog(raw);

    console.log(
      "SME CATALOG FINAL:",
      JSON.stringify(
        {
          electricity:
            catalog.electricityProviders,
          cable:
            catalog.cableProviders,
          education:
            catalog.examProviders,
        },
        null,
        2
      )
    );

    return NextResponse.json({
      success: true,
      ...catalog,
    });
  } catch (error: any) {
    console.error(
      "================================="
    );

    console.error(
      "SME CATALOG ERROR:",
      error
    );

    console.error(
      "================================="
    );

    if (error instanceof ProviderError) {
      return NextResponse.json(
        {
          error:
            error.message,
          details:
            error.details,
        },
        {
          status:
            error.status,
        }
      );
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to fetch SME catalog",
      },
      {
        status: 500,
      }
    );
  }
}