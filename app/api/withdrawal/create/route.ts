import { NextResponse } from "next/server";

/*
 * Customer withdrawals are no longer supported
 * in the Dozentelecom customer wallet system.
 *
 * Customer wallet funds are intended to remain
 * available for purchasing Dozentelecom services.
 */

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Customer withdrawals are no longer available. Your wallet balance can be used to purchase Dozentelecom services.",
    },
    {
      status: 410,
    }
  );
}