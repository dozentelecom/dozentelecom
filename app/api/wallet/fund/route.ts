import { NextResponse } from "next/server";

import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import {
  User,
  Funding,
} from "@/lib/models";
import { paystack } from "@/lib/paystack";
import { getRates } from "@/lib/settings";

export async function POST(
  req: Request
) {
  try {
    /* =======================================================
       AUTHENTICATION
       ======================================================= */

    const userId =
      await currentUserId();

    if (!userId) {
      return NextResponse.redirect(
        new URL(
          "/login",
          req.url
        )
      );
    }

    /* =======================================================
       READ AMOUNT
       ======================================================= */

    const formData =
      await req.formData();

    const rawAmount =
      formData.get("amount");

    const amount =
      Number(rawAmount);

    if (
      !Number.isFinite(amount) ||
      amount < 100
    ) {
      return NextResponse.json(
        {
          error:
            "Minimum funding is ₦100",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Convert to kobo immediately.
     *
     * This avoids floating-point inconsistencies.
     */
    const grossKobo =
      Math.round(amount * 100);

    if (
      !Number.isInteger(
        grossKobo
      ) ||
      grossKobo < 10000
    ) {
      return NextResponse.json(
        {
          error:
            "Minimum funding is ₦100",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       DATABASE
       ======================================================= */

    await db();

    const user: any =
      await User.findById(
        userId
      );

    if (!user) {
      return NextResponse.json(
        {
          error:
            "User not found",
        },
        {
          status: 404,
        }
      );
    }

    /* =======================================================
       KYC
       ======================================================= */

    if (
      user.kyc?.status !==
      "VERIFIED"
    ) {
      return NextResponse.redirect(
        new URL(
          "/kyc",
          req.url
        )
      );
    }

    /* =======================================================
       FUNDING RATE
       ======================================================= */

    const rates =
      await getRates();

    const fundingRate =
      Number(
        rates.funding || 0
      );

    if (
      !Number.isFinite(
        fundingRate
      ) ||
      fundingRate < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid funding rate configuration",
        },
        {
          status: 500,
        }
      );
    }

    /* =======================================================
       CALCULATE FEE
       ======================================================= */

    const feeKobo =
      Math.ceil(
        (grossKobo *
          fundingRate) /
          100
      );

    const creditKobo =
      grossKobo -
      feeKobo;

    if (
      creditKobo <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Funding amount is too small for the configured funding fee",
        },
        {
          status: 400,
        }
      );
    }

    /* =======================================================
       REFERENCE
       ======================================================= */

    const reference =
      `DZT-FUND-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

    /* =======================================================
       CREATE FUNDING RECORD
       ======================================================= */

    await Funding.create({
      userId: userId,

      reference,

      grossKobo,

      feeKobo,

      creditKobo,

      status:
        "PENDING",
    });

    /* =======================================================
       INITIALIZE PAYSTACK PAYMENT
       ======================================================= */

    try {
      const payment =
        await paystack(
          "/transaction/initialize",
          {
            email:
              user.email,

            amount:
              grossKobo,

            reference,

            callback_url:
              process.env
                .PAYSTACK_CALLBACK_URL,

            metadata: {
              userId:
                String(userId),

              fundingReference:
                reference,

              fundingAmount:
                grossKobo / 100,

              fundingAmountKobo:
                grossKobo,

              fee:
                feeKobo / 100,

              feeKobo,

              credit:
                creditKobo / 100,

              creditKobo,
            },
          }
        );

      const authorizationUrl =
        payment?.data
          ?.authorization_url;

      const paystackReference =
        payment?.data
          ?.reference;

      if (
        !authorizationUrl
      ) {
        throw new Error(
          "Paystack did not return a payment authorization URL"
        );
      }

      await Funding.findOneAndUpdate(
        {
          reference,
        },
        {
          $set: {
            paystackReference:
              paystackReference ||
              reference,

            providerData:
              payment.data,
          },
        }
      );

      /* =====================================================
         REDIRECT CUSTOMER TO PAYSTACK
         ===================================================== */

      return NextResponse.redirect(
        authorizationUrl
      );
    } catch (
      error: any
    ) {
      console.error(
        "=== PAYSTACK FUNDING INITIALIZATION FAILED ==="
      );

      console.error(error);

      await Funding.findOneAndUpdate(
        {
          reference,
        },
        {
          $set: {
            status:
              "FAILED",
          },
        }
      );

      return NextResponse.json(
        {
          error:
            error?.message ||
            "Unable to initialize Paystack payment",
        },
        {
          status: 502,
        }
      );
    }
  } catch (
    error: any
  ) {
    console.error(
      "=== FUNDING ROUTE ERROR ==="
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to process funding request",
      },
      {
        status: 500,
      }
    );
  }
}