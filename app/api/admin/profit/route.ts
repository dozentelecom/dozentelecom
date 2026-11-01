import { NextResponse } from "next/server";
import { requireAdminApi, adminApiErrorStatus } from "@/lib/requireAdminApi";
import { getProfitSummary } from "@/lib/profit";
import { paystackGet } from "@/lib/paystack";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminApi();
    const profit = await getProfitSummary();

    let paystackBalanceKobo = 0;
    try {
      const balance = await paystackGet("/balance");
      const ngn = balance?.data?.find((item: any) => item.currency === "NGN");
      paystackBalanceKobo = Number(ngn?.balance || 0);
    } catch {
      paystackBalanceKobo = 0;
    }

    return NextResponse.json({
      ...profit,
      paystackBalanceKobo,
      maxWithdrawableKobo: Math.min(profit.availableProfitKobo, paystackBalanceKobo),
    });
  } catch (error: unknown) {
    const status = adminApiErrorStatus(error);
    return NextResponse.json(
      { error: status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "Unable to load profit summary" },
      { status }
    );
  }
}
