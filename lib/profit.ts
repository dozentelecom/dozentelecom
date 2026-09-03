import { db } from "./db";
import { Transaction, ProfitWithdrawal } from "./models";

export async function getProfitSummary() {
  await db();

  const transactionProfit = await Transaction.aggregate([
    {
      $match: {
        status: "SUCCESS",
        profitKobo: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        totalProfitKobo: {
          $sum: "$profitKobo",
        },
      },
    },
  ]);

  const withdrawalTotals = await ProfitWithdrawal.aggregate([
    {
      $match: {
        status: {
          $in: ["PENDING", "PROCESSING", "SUCCESS"],
        },
      },
    },
    {
      $group: {
        _id: null,
        totalKobo: {
          $sum: "$amountKobo",
        },
      },
    },
  ]);

  const totalProfitKobo = Number(
    transactionProfit?.[0]?.totalProfitKobo || 0
  );

  const reservedKobo = Number(
    withdrawalTotals?.[0]?.totalKobo || 0
  );

  const availableProfitKobo = Math.max(
    0,
    totalProfitKobo - reservedKobo
  );

  return {
    totalProfitKobo,
    reservedKobo,
    availableProfitKobo,
  };
}