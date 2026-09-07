import { NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/lib/db";
import { Giveaway } from "@/lib/models";
import { currentUserId } from "@/lib/session";
import { requirePin } from "@/lib/authz";
import { smeapi, ProviderError } from "@/lib/smeapi";
import { getRates } from "@/lib/settings";
import { percentPrice, roundAirtime } from "@/lib/pricing";


function getPlans(result: any) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.plans)) {
    return result.plans;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.data?.plans)) {
    return result.data.plans;
  }

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


function getPlanNetwork(plan: any) {
  return String(
    plan?.network_id ??
      plan?.network ??
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
      plan?.plan_name ??
      plan?.plan ??
      plan?.variation ??
      plan?.description ??
      "Data plan"
  );
}


export async function POST(req: Request) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const type = String(
      body.type || ""
    ).toUpperCase();

    const network = Number(body.network);

    const recipientLimit = Number(
      body.recipientLimit
    );

    const pin = String(
      body.pin || ""
    );

    /*
     * Validate transaction PIN.
     */
    await requirePin(pin);

    /*
     * Basic validation.
     */
    if (
      !["AIRTIME", "DATA"].includes(type)
    ) {
      return NextResponse.json(
        {
          error:
            "Giveaway type must be AIRTIME or DATA",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(network) ||
      network <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid network is required",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(recipientLimit) ||
      recipientLimit < 1 ||
      recipientLimit > 10000
    ) {
      return NextResponse.json(
        {
          error:
            "Recipient count must be between 1 and 10,000",
        },
        { status: 400 }
      );
    }


    /*
     * =====================================================
     * AIRTIME GIVEAWAY
     * =====================================================
     */

    if (type === "AIRTIME") {
      const inputAmount = Number(
        body.amount
      );

      if (
        !Number.isFinite(inputAmount) ||
        inputAmount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "A valid airtime amount is required",
          },
          { status: 400 }
        );
      }

      const rates = await getRates();

      /*
       * Keep your existing airtime rounding
       * configuration.
       */
      const rewardAmount = roundAirtime(
        inputAmount,
        rates.airtimeRoundUnit || 10
      );

      const rewardPriceKobo =
        Math.round(rewardAmount * 100);

      /*
       * Total amount that may be distributed.
       */
      const totalKobo =
        rewardPriceKobo *
        recipientLimit;


      /*
       * Check wallet balance before
       * creating the giveaway.
       *
       * We don't debit the wallet yet.
       * Each successful claim will debit
       * the creator's wallet.
       */
      await db();

      const token =
        crypto.randomBytes(24).toString("hex");

      const giveaway =
        await Giveaway.create({
          creatorId: userId,
          token,

          type: "AIRTIME",
          network,

          airtimeAmount:
            rewardAmount,

          providerCostKobo:
            rewardPriceKobo,

          rewardPriceKobo,

          recipientLimit,

          claimedCount: 0,

          status: "ACTIVE",
        });

      return NextResponse.json({
        success: true,

        giveaway: {
          id: String(giveaway._id),
          token,
          type: "AIRTIME",
          network,
          amount: rewardAmount,
          recipientLimit,
          totalAmount:
            totalKobo / 100,
          claimedCount: 0,
          remaining:
            recipientLimit,
          status: "ACTIVE",

          link:
            `https://dozentelecom.vercel.app/gift/${token}`,
        },
      });
    }


    /*
     * =====================================================
     * DATA GIVEAWAY
     * =====================================================
     */

    const dataPlan = Number(
      body.data_plan
    );

    if (
      !Number.isFinite(dataPlan) ||
      dataPlan <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid data plan is required",
        },
        { status: 400 }
      );
    }


    /*
     * NEVER trust the browser price.
     *
     * Fetch the current SMEAPI plans and
     * determine the provider cost here.
     */
    const rawPlans =
      await smeapi.dataPlans();

    const plans =
      getPlans(rawPlans);

    const plan =
      plans.find((p: any) => {
        const idMatches =
          getPlanId(p) ===
          String(dataPlan);

        const networkValue =
          getPlanNetwork(p);

        const networkMatches =
          !networkValue ||
          networkValue ===
            String(network);

        return (
          idMatches &&
          networkMatches
        );
      });


    if (!plan) {
      return NextResponse.json(
        {
          error:
            "Selected data plan could not be found",
        },
        { status: 400 }
      );
    }


    const providerCost =
      getPlanCost(plan);


    if (
      !Number.isFinite(providerCost) ||
      providerCost <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Selected data plan has an invalid provider price",
        },
        { status: 400 }
      );
    }


    const rates =
      await getRates();


    /*
     * THIS IS YOUR EXISTING PROFIT/MARKUP.
     *
     * If admin sets Data markup to 5%,
     * the giveaway uses that same 5%.
     */
    const customerPrice =
      percentPrice(
        providerCost,
        Number(rates.data || 0)
      );


    const providerCostKobo =
      Math.round(
        providerCost * 100
      );

    const rewardPriceKobo =
      Math.round(
        customerPrice * 100
      );


    const totalKobo =
      rewardPriceKobo *
      recipientLimit;


    await db();


    const token =
      crypto.randomBytes(24).toString("hex");


    const giveaway =
      await Giveaway.create({
        creatorId: userId,

        token,

        type: "DATA",

        network,

        dataPlan,

        dataPlanName:
          getPlanName(plan),

        providerCostKobo,

        rewardPriceKobo,

        recipientLimit,

        claimedCount: 0,

        status: "ACTIVE",
      });


    return NextResponse.json({
      success: true,

      giveaway: {
        id: String(giveaway._id),

        token,

        type: "DATA",

        network,

        dataPlan,

        dataPlanName:
          getPlanName(plan),

        providerCost,

        rewardPrice:
          customerPrice,

        markup:
          Number(rates.data || 0),

        recipientLimit,

        totalAmount:
          totalKobo / 100,

        claimedCount: 0,

        remaining:
          recipientLimit,

        status: "ACTIVE",

        link:
          `https://dozentelecom.vercel.app/gift/${token}`,
      },
    });

  } catch (e: any) {

    const status =
      e instanceof ProviderError
        ? e.status
        : e?.message === "UNAUTHORIZED"
        ? 401
        : 400;

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Unable to create giveaway",

        details:
          e?.details,
      },
      { status }
    );
  }
}