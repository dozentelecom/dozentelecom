import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { Giveaway, GiveawayClaim } from "@/lib/models";
import { smeapi, ProviderError } from "@/lib/smeapi";
import {
  startServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

function normalizePhone(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function getPlans(result: any) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.plans)) return result.plans;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.data?.plans)) return result.data.plans;
  return [];
}

function getPlanId(plan: any) {
  return String(
    plan?.id ??
      plan?.plan_id ??
      plan?.data_plan ??
      ""
  );
}

function getPlanCost(plan: any) {
  return Number(
    plan?.price ??
      plan?.amount ??
      plan?.selling_price ??
      plan?.cost ??
      0
  );
}

function getPlanName(plan: any) {
  return String(
    plan?.name ??
      plan?.data_plan ??
      plan?.plan ??
      "Data"
  );
}

function providerFailed(result: any) {
  const values = [
    result?.success,
    result?.status,
    result?.data?.success,
    result?.data?.status,
  ];

  return values.some(
    (v) =>
      v === false ||
      ["failed", "error", "reversed"].includes(
        String(v).toLowerCase()
      )
  );
}

function providerReference(result: any) {
  return (
    result?.data?.reference ||
    result?.reference ||
    result?.data?.transaction_reference ||
    result?.transaction_reference ||
    result?.data?.id ||
    result?.id
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {  
let reference = "";
  let claim: any = null;
  let giveaway: any = null;

  try {
    await db();

    const { token: rawToken } = await params;
const token = String(rawToken || "").trim();

    if (!token) {
      return NextResponse.json(
        { error: "Invalid giveaway link" },
        { status: 400 }
      );
    }

    const body = await req.json();

    const phone = normalizePhone(body.phone);

    if (!/^[0-9]{11}$/.test(phone)) {
      return NextResponse.json(
        {
          error: "Enter a valid 11-digit Nigerian phone number",
        },
        { status: 400 }
      );
    }

    giveaway = await Giveaway.findOne({ token });

    if (!giveaway) {
      return NextResponse.json(
        { error: "Giveaway not found" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (giveaway.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "This giveaway is no longer active" },
        { status: 400 }
      );
    }

    if (
      giveaway.expiresAt &&
      new Date(giveaway.expiresAt).getTime() <= now.getTime()
    ) {
      giveaway.status = "COMPLETED";
      await giveaway.save();

      return NextResponse.json(
        { error: "This giveaway has expired" },
        { status: 400 }
      );
    }

    if (
      Number(giveaway.claimedCount || 0) >=
      Number(giveaway.recipientLimit || 0)
    ) {
      giveaway.status = "COMPLETED";
      await giveaway.save();

      return NextResponse.json(
        { error: "All giveaway slots have been claimed" },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * CREATE CLAIM RECORD FIRST
     * ---------------------------------------------------------
     *
     * The unique index on:
     * giveawayId + phone
     *
     * prevents the same number from claiming twice.
     */

    try {
      claim = await GiveawayClaim.create({
  giveawayId: giveaway._id,
  creatorId: giveaway.creatorId,
  phone,
  type: giveaway.type,
  network: giveaway.network,
  amountKobo: giveaway.rewardPriceKobo,
  status: "PROCESSING",
});
    } catch (error: any) {
      if (error?.code === 11000) {
        return NextResponse.json(
          {
            error:
              "This phone number has already claimed this giveaway",
          },
          { status: 400 }
        );
      }

      throw error;
    }

    /*
     * ---------------------------------------------------------
     * RESERVE ONE GIVEAWAY SLOT ATOMICALLY
     * ---------------------------------------------------------
     */

    const reserved = await Giveaway.findOneAndUpdate(
      {
        _id: giveaway._id,
        status: "ACTIVE",
        claimedCount: {
          $lt: Number(giveaway.recipientLimit || 0),
        },
      },
      {
        $inc: {
          claimedCount: 1,
        },
      },
      {
        new: true,
      }
    );

    if (!reserved) {
      await GiveawayClaim.deleteOne({
        _id: claim._id,
      });

      return NextResponse.json(
        {
          error: "All giveaway slots have been claimed",
        },
        { status: 400 }
      );
    }

    giveaway = reserved;

    /*
     * ---------------------------------------------------------
     * CREATE INTERNAL TRANSACTION
     * ---------------------------------------------------------
     *
     * The giveaway creator pays for each successful claim.
     */

    reference =
      `GIFT-${Date.now()}-` +
      Math.random().toString(36).slice(2, 8).toUpperCase();

    let providerCostKobo = 0;

    if (giveaway.type === "AIRTIME") {
      providerCostKobo = Number(giveaway.rewardPriceKobo || 0);
    } else if (giveaway.type === "DATA") {
      providerCostKobo = Number(
        giveaway.providerCostKobo ||
          giveaway.rewardPriceKobo ||
          0
      );
    }

    if (!Number.isInteger(providerCostKobo) || providerCostKobo <= 0) {
      throw new Error("INVALID_GIVEAWAY_AMOUNT");
    }

    await startServiceTransaction({
      userId: String(giveaway.creatorId),
      service:
        giveaway.type === "AIRTIME"
          ? "GIVEAWAY_AIRTIME"
          : "GIVEAWAY_DATA",
      amountKobo: Number(giveaway.rewardPriceKobo),
      reference,
      metadata: {
        giveawayId: String(giveaway._id),
        claimId: String(claim._id),
        phone,
        type: giveaway.type,
      },
    });

    /*
     * ---------------------------------------------------------
     * SEND AIRTIME
     * ---------------------------------------------------------
     */

    if (giveaway.type === "AIRTIME") {
      const amount =
        Number(giveaway.rewardPriceKobo) / 100;

      const result = await smeapi.airtime({
        network: Number(giveaway.network),
        phone,
        amount,
        airtime_type: "VTU",
        ported_number: false,
        ref: reference,
      });

      if (providerFailed(result)) {
        throw new ProviderError(
          result?.message ||
            result?.provider_message ||
            "Airtime provider rejected transaction",
          400,
          result
        );
      }

      await completeServiceTransaction({
        reference,
        costKobo: providerCostKobo,
        providerTransactionId: providerReference(result)
          ? String(providerReference(result))
          : undefined,
        metadata: {
          giveaway: true,
          providerResponse: result,
        },
      });

      claim.status = "SUCCESS";
      claim.transactionReference = reference;
      claim.claimedAt = new Date();
      await claim.save();

      if (
        Number(giveaway.claimedCount) >=
        Number(giveaway.recipientLimit)
      ) {
        giveaway.status = "COMPLETED";
      }

      await giveaway.save();

      return NextResponse.json({
        success: true,
        message: "Giveaway claimed successfully",
        gift: {
          type: "AIRTIME",
          amount,
          phone,
          transactionReference: reference,
        },
      });
    }

    /*
     * ---------------------------------------------------------
     * SEND DATA
     * ---------------------------------------------------------
     */

    if (giveaway.type === "DATA") {
      const rawPlans = await smeapi.dataPlans();

      const plans = getPlans(rawPlans);

      const plan = plans.find(
        (p: any) =>
          getPlanId(p) === String(giveaway.dataPlan)
      );

      if (!plan) {
        throw new ProviderError(
          "The selected data plan is no longer available",
          400
        );
      }

      const providerCost = getPlanCost(plan);

      if (
        !Number.isFinite(providerCost) ||
        providerCost <= 0
      ) {
        throw new ProviderError(
          "Invalid provider price for selected data plan",
          400
        );
      }

      const result = await smeapi.data({
        network: Number(giveaway.network),
        data_plan: Number(giveaway.dataPlan),
        phone,
        ported_number: false,
        ref: reference,
      });

      if (providerFailed(result)) {
        throw new ProviderError(
          result?.message ||
            result?.provider_message ||
            "Data provider rejected transaction",
          400,
          result
        );
      }

      await completeServiceTransaction({
        reference,
        costKobo: Math.round(providerCost * 100),
        providerTransactionId: providerReference(result)
          ? String(providerReference(result))
          : undefined,
        metadata: {
          giveaway: true,
          providerResponse: result,
          plan,
        },
      });

      claim.status = "SUCCESS";
      claim.transactionReference = reference;
      claim.claimedAt = new Date();
      await claim.save();

      if (
        Number(giveaway.claimedCount) >=
        Number(giveaway.recipientLimit)
      ) {
        giveaway.status = "COMPLETED";
      }

      await giveaway.save();

      return NextResponse.json({
        success: true,
        message: "Giveaway claimed successfully",
        gift: {
          type: "DATA",
          planName: getPlanName(plan),
          phone,
          transactionReference: reference,
        },
      });
    }

    throw new Error("INVALID_GIVEAWAY_TYPE");
  } catch (error: any) {
    console.error("GIVEAWAY CLAIM ERROR:", error);

    /*
     * ---------------------------------------------------------
     * REFUND CREATOR IF MONEY WAS DEBITED
     * ---------------------------------------------------------
     */

    if (reference) {
      try {
        await failServiceTransaction({
          reference,
          reason:
            error?.message ||
            "Giveaway provider transaction failed",
          metadata: {
            giveaway: true,
            providerError: error?.details || null,
          },
        });
      } catch (refundError) {
        console.error(
          "GIVEAWAY REFUND ERROR:",
          refundError
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * RELEASE THE GIVEAWAY SLOT
     * ---------------------------------------------------------
     */

    if (giveaway?._id) {
      try {
        await Giveaway.findOneAndUpdate(
          {
            _id: giveaway._id,
            claimedCount: { $gt: 0 },
          },
          {
            $inc: {
              claimedCount: -1,
            },
          }
        );
      } catch (slotError) {
        console.error(
          "GIVEAWAY SLOT RELEASE ERROR:",
          slotError
        );
      }
    }

    if (claim?._id) {
      try {
        claim.status = "FAILED";
        claim.failureReason =
          error?.message || "Giveaway claim failed";
        await claim.save();
      } catch (claimError) {
        console.error(
          "GIVEAWAY CLAIM SAVE ERROR:",
          claimError
        );
      }
    }

    const status =
      error instanceof ProviderError
        ? error.status
        : error?.message === "INSUFFICIENT_BALANCE"
        ? 400
        : 400;

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to process giveaway claim",
        details:
          error instanceof ProviderError
            ? error.details
            : undefined,
      },
      { status }
    );
  }
}