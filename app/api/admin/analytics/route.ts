import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { Transaction, User } from "@/lib/models";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const id = await currentUserId();

  if (!id) throw new Error("UNAUTHORIZED");

  await db();

  const admin: any = await User.findById(id)
    .select("role")
    .lean();

  if (!admin || admin.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return id;
}

function getRange(range: string) {
  const now = new Date();

  const end = new Date(now);

  const start = new Date(now);

  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

function isSuccessful(status: string) {
  return [
    "SUCCESS",
    "SUCCESSFUL",
    "COMPLETED",
    "success",
    "successful",
    "completed",
  ].includes(status);
}

function isFailed(status: string) {
  return [
    "FAILED",
    "FAILURE",
    "failed",
    "failure",
  ].includes(status);
}

function isPending(status: string) {
  return [
    "PENDING",
    "PROCESSING",
    "pending",
    "processing",
  ].includes(status);
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);

    const requestedRange =
      searchParams.get("range") || "today";

    const range =
      requestedRange === "7d" ||
      requestedRange === "30d"
        ? requestedRange
        : "today";

    const { start, end } = getRange(range);

    /*
     * Only completed transactions count as actual
     * revenue/provider cost/profit.
     *
     * Failed and pending transactions are tracked
     * separately below.
     */
    const transactions: any[] =
      await Transaction.find({
        createdAt: {
          $gte: start,
          $lte: end,
        },
      })
        .select(
          "service status amountKobo costKobo profitKobo createdAt"
        )
        .sort({ createdAt: 1 })
        .lean();

    let revenueKobo = 0;
    let providerCostKobo = 0;
    let profitKobo = 0;

    let successfulCount = 0;
    let failedCount = 0;
    let pendingCount = 0;

    const serviceMap: Record<
      string,
      {
        revenueKobo: number;
        costKobo: number;
        profitKobo: number;
        transactions: number;
      }
    > = {};

    const dailyMap: Record<
      string,
      {
        revenueKobo: number;
        profitKobo: number;
        transactions: number;
      }
    > = {};

    for (const tx of transactions) {
      const status = String(tx.status || "");
      const service = String(
        tx.service || "other"
      ).toLowerCase();

      if (isSuccessful(status)) {
        successfulCount++;

        const revenue = Number(tx.amountKobo || 0);
        const cost = Number(tx.costKobo || 0);
        const profit = Number(tx.profitKobo || 0);

        revenueKobo += revenue;
        providerCostKobo += cost;
        profitKobo += profit;

        if (!serviceMap[service]) {
          serviceMap[service] = {
            revenueKobo: 0,
            costKobo: 0,
            profitKobo: 0,
            transactions: 0,
          };
        }

        serviceMap[service].revenueKobo += revenue;
        serviceMap[service].costKobo += cost;
        serviceMap[service].profitKobo += profit;
        serviceMap[service].transactions++;

        const date = new Date(
          tx.createdAt
        )
          .toISOString()
          .slice(0, 10);

        if (!dailyMap[date]) {
          dailyMap[date] = {
            revenueKobo: 0,
            profitKobo: 0,
            transactions: 0,
          };
        }

        dailyMap[date].revenueKobo += revenue;
        dailyMap[date].profitKobo += profit;
        dailyMap[date].transactions++;
      } else if (isFailed(status)) {
        failedCount++;
      } else if (isPending(status)) {
        pendingCount++;
      }
    }

    const totalTransactions = transactions.length;

    const profitMargin =
      revenueKobo > 0
        ? Number(
            ((profitKobo / revenueKobo) * 100).toFixed(2)
          )
        : 0;

    const services = [
      "data",
      "airtime",
      "electricity",
      "cable",
      "education",
    ].map((service) => ({
      service,
      revenueKobo:
        serviceMap[service]?.revenueKobo || 0,
      costKobo:
        serviceMap[service]?.costKobo || 0,
      profitKobo:
        serviceMap[service]?.profitKobo || 0,
      transactions:
        serviceMap[service]?.transactions || 0,
    }));

    const daily = Object.entries(dailyMap).map(
      ([date, values]) => ({
        date,
        ...values,
      })
    );

    return NextResponse.json({
      range,

      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },

      overview: {
        revenueKobo,
        providerCostKobo,
        profitKobo,
        profitMargin,
        transactionCount: totalTransactions,
        successfulCount,
        failedCount,
        pendingCount,
      },

      services,

      daily,
    });
  } catch (error: any) {
    console.error(
      "ADMIN ANALYTICS ERROR:",
      error
    );

    const status =
      error?.message === "UNAUTHORIZED"
        ? 401
        : error?.message === "FORBIDDEN"
        ? 403
        : 500;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load analytics",
      },
      { status }
    );
  }
}