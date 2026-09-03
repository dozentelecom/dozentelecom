import { NextResponse } from "next/server";

import {
  wisesub,
  WiseSubError,
} from "@/lib/wisesub";

import { requirePin } from "@/lib/authz";
import { currentUserId } from "@/lib/session";
import { getRates } from "@/lib/settings";
import { percentPrice } from "@/lib/pricing";

import {
  startServiceTransaction,
  completeServiceTransaction,
  failServiceTransaction,
} from "@/lib/serviceTransaction";

function getPackages(result: any) {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.packages)) {
    return result.packages;
  }

  if (Array.isArray(result?.data)) {
    return result.data;
  }

  if (Array.isArray(result?.data?.packages)) {
    return result.data.packages;
  }

  return [];
}

function packageCode(pkg: any) {
  return String(
    pkg?.code ??
      pkg?.package_code ??
      pkg?.id ??
      ""
  );
}

function packagePrice(pkg: any) {
  return Number(
    pkg?.price ??
      pkg?.amount ??
      pkg?.selling_price ??
      pkg?.cost ??
      0
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

export async function POST(req: Request) {
  let reference = "";

  try {
    const b = await req.json();

    await requirePin(String(b.pin || ""));

    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const serviceType = String(
      b.service_type || ""
    ).toLowerCase();

    const providerCode = String(
      b.provider_code || ""
    ).trim();

    if (!serviceType || !providerCode) {
      return NextResponse.json(
        {
          error:
            "service_type and provider_code are required",
        },
        { status: 400 }
      );
    }

    const rates = await getRates();

    /*
     * ============================
     * ELECTRICITY
     * ============================
     */

    if (
      serviceType === "electricity"
    ) {
      const meterNumber = String(
        b.meter_number || ""
      );

      const meterType = String(
        b.meter_type || ""
      );

      const inputAmount = Number(
        b.amount
      );

      const phone = String(
        b.phone || ""
      );

      if (
        !meterNumber ||
        !meterType ||
        !Number.isFinite(inputAmount) ||
        inputAmount <= 0 ||
        !/^[0-9]{11}$/.test(phone)
      ) {
        return NextResponse.json(
          {
            error:
              "meter number, meter type, valid amount and phone are required",
          },
          { status: 400 }
        );
      }

      const customerPrice =
        percentPrice(
          inputAmount,
          Number(rates.electricity || 0)
        );

      const customerKobo =
        Math.round(customerPrice * 100);

      const providerCostKobo =
        Math.round(inputAmount * 100);

      reference =
        `electricity-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      await startServiceTransaction({
        userId,
        service: "ELECTRICITY",
        amountKobo: customerKobo,
        reference,
        metadata: {
          providerCode,
          meterNumber,
          meterType,
          phone,
          providerCost: inputAmount,
          customerPrice,
        },
      });

      let result: any;

      try {
        result = await wisesub.purchase({
          service_type: "electricity",
          provider_code: providerCode,
          meter_number: meterNumber,
          meter_type: meterType,
          amount: inputAmount,
          phone,
          reference,
        });
      } catch (error: any) {
        if (
          error instanceof WiseSubError
        ) {
          /*
           * DO NOT immediately refund on
           * timeout/unknown provider state.
           *
           * Leave transaction pending so it
           * can be checked/reconciled.
           */
          if (
            error.status >= 500 ||
            error.message
              ?.toLowerCase()
              .includes("timeout")
          ) {
            return NextResponse.json(
              {
                error:
                  "Electricity transaction is being verified. Please check transaction status shortly.",
                reference,
              },
              { status: 202 }
            );
          }
        }

        await failServiceTransaction({
          reference,
          reason:
            error.message ||
            "Electricity purchase failed",
          metadata: {
            providerError: error.details,
          },
        });

        throw error;
      }

      if (providerFailed(result)) {
        await failServiceTransaction({
          reference,
          reason:
            result?.message ||
            result?.provider_message ||
            "Electricity provider rejected transaction",
          metadata: {
            providerResponse: result,
          },
        });

        return NextResponse.json(
          {
            error:
              result?.message ||
              result?.provider_message ||
              "Electricity transaction failed",
          },
          { status: 400 }
        );
      }

      await completeServiceTransaction({
        reference,
        costKobo: providerCostKobo,
        providerTransactionId:
          providerReference(result)
            ? String(
                providerReference(result)
              )
            : undefined,
        metadata: {
          providerResponse: result,
        },
      });

      return NextResponse.json({
        ...result,
        reference,
        pricing: {
          providerCost: inputAmount,
          customerPrice,
          markup:
            Number(
              rates.electricity || 0
            ),
          profit:
            customerPrice -
            inputAmount,
        },
      });
    }

    /*
     * ============================
     * CABLE TV
     * ============================
     */

    if (
      serviceType === "cabletv"
    ) {
      const packageCodeValue =
        String(
          b.package_code || ""
        ).trim();

      const decoderNumber =
        String(
          b.decoder_number || ""
        ).trim();

      const phone = String(
        b.phone || ""
      );

      const subscriptionType =
        String(
          b.subscription_type || ""
        );

      if (
        !packageCodeValue ||
        !decoderNumber ||
        !subscriptionType ||
        !/^[0-9]{11}$/.test(phone)
      ) {
        return NextResponse.json(
          {
            error:
              "package, decoder number, subscription type and valid phone are required",
          },
          { status: 400 }
        );
      }

      const rawPackages =
        await wisesub.packages(
          "cabletv",
          providerCode
        );

      const packages =
        getPackages(rawPackages);

      const selectedPackage =
        packages.find(
          (pkg: any) =>
            packageCode(pkg) ===
            packageCodeValue
        );

      if (!selectedPackage) {
        return NextResponse.json(
          {
            error:
              "Selected cable package could not be found",
          },
          { status: 400 }
        );
      }

      const providerCost =
        packagePrice(
          selectedPackage
        );

      if (
        !Number.isFinite(providerCost) ||
        providerCost <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Selected cable package has an invalid provider price",
          },
          { status: 400 }
        );
      }

      const customerPrice =
        percentPrice(
          providerCost,
          Number(rates.cable || 0)
        );

      const customerKobo =
        Math.round(customerPrice * 100);

      const providerCostKobo =
        Math.round(providerCost * 100);

      reference =
        `cable-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      await startServiceTransaction({
        userId,
        service: "CABLE",
        amountKobo: customerKobo,
        reference,
        metadata: {
          providerCode,
          packageCode:
            packageCodeValue,
          decoderNumber,
          phone,
          subscriptionType,
          providerCost,
          customerPrice,
        },
      });

      let result: any;

      try {
        result =
          await wisesub.purchase({
            service_type: "cabletv",
            provider_code:
              providerCode,
            package_code:
              packageCodeValue,
            decoder_number:
              decoderNumber,
            phone,
            subscription_type:
              subscriptionType,
            reference,
          });
      } catch (error: any) {
        if (
          error instanceof WiseSubError &&
          (error.status >= 500 ||
            error.message
              ?.toLowerCase()
              .includes("timeout"))
        ) {
          return NextResponse.json(
            {
              error:
                "Cable transaction is being verified. Please check transaction status shortly.",
              reference,
            },
            { status: 202 }
          );
        }

        await failServiceTransaction({
          reference,
          reason:
            error.message ||
            "Cable purchase failed",
          metadata: {
            providerError:
              error.details,
          },
        });

        throw error;
      }

      if (providerFailed(result)) {
        await failServiceTransaction({
          reference,
          reason:
            result?.message ||
            result?.provider_message ||
            "Cable provider rejected transaction",
          metadata: {
            providerResponse: result,
          },
        });

        return NextResponse.json(
          {
            error:
              result?.message ||
              result?.provider_message ||
              "Cable transaction failed",
          },
          { status: 400 }
        );
      }

      await completeServiceTransaction({
        reference,
        costKobo: providerCostKobo,
        providerTransactionId:
          providerReference(result)
            ? String(
                providerReference(result)
              )
            : undefined,
        metadata: {
          providerResponse: result,
          package:
            selectedPackage,
        },
      });

      return NextResponse.json({
        ...result,
        reference,
        pricing: {
          providerCost,
          customerPrice,
          markup:
            Number(rates.cable || 0),
          profit:
            customerPrice -
            providerCost,
        },
      });
    }

    /*
     * ============================
     * EDUCATION
     * ============================
     */

    if (
      serviceType === "education"
    ) {
      const packageCodeValue =
        String(
          b.package_code || ""
        ).trim();

      const recipient =
        String(
          b.recipient || ""
        ).trim();

      const quantity = Math.max(
        1,
        Number(b.quantity || 1)
      );

      if (
        !packageCodeValue ||
        !recipient ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        return NextResponse.json(
          {
            error:
              "package, recipient and valid quantity are required",
          },
          { status: 400 }
        );
      }

      const rawPackages =
        await wisesub.packages(
          "education",
          providerCode
        );

      const packages =
        getPackages(rawPackages);

      const selectedPackage =
        packages.find(
          (pkg: any) =>
            packageCode(pkg) ===
            packageCodeValue
        );

      if (!selectedPackage) {
        return NextResponse.json(
          {
            error:
              "Selected education package could not be found",
          },
          { status: 400 }
        );
      }

      const unitCost =
        packagePrice(
          selectedPackage
        );

      if (
        !Number.isFinite(unitCost) ||
        unitCost <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "Selected education package has an invalid provider price",
          },
          { status: 400 }
        );
      }

      const providerCost =
        unitCost * quantity;

      const customerPrice =
        percentPrice(
          providerCost,
          Number(rates.education || 0)
        );

      const customerKobo =
        Math.round(customerPrice * 100);

      const providerCostKobo =
        Math.round(providerCost * 100);

      reference =
        `education-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`;

      await startServiceTransaction({
        userId,
        service: "EDUCATION",
        amountKobo: customerKobo,
        reference,
        metadata: {
          providerCode,
          packageCode:
            packageCodeValue,
          recipient,
          quantity,
          unitCost,
          providerCost,
          customerPrice,
        },
      });

      let result: any;

      try {
        result =
          await wisesub.purchase({
            service_type:
              "education",
            provider_code:
              providerCode,
            package_code:
              packageCodeValue,
            recipient,
            quantity,
            reference,
          });
      } catch (error: any) {
        if (
          error instanceof WiseSubError &&
          (error.status >= 500 ||
            error.message
              ?.toLowerCase()
              .includes("timeout"))
        ) {
          return NextResponse.json(
            {
              error:
                "Education transaction is being verified. Please check transaction status shortly.",
              reference,
            },
            { status: 202 }
          );
        }

        await failServiceTransaction({
          reference,
          reason:
            error.message ||
            "Education purchase failed",
          metadata: {
            providerError:
              error.details,
          },
        });

        throw error;
      }

      if (providerFailed(result)) {
        await failServiceTransaction({
          reference,
          reason:
            result?.message ||
            result?.provider_message ||
            "Education provider rejected transaction",
          metadata: {
            providerResponse: result,
          },
        });

        return NextResponse.json(
          {
            error:
              result?.message ||
              result?.provider_message ||
              "Education transaction failed",
          },
          { status: 400 }
        );
      }

      await completeServiceTransaction({
        reference,
        costKobo: providerCostKobo,
        providerTransactionId:
          providerReference(result)
            ? String(
                providerReference(result)
              )
            : undefined,
        metadata: {
          providerResponse: result,
          package:
            selectedPackage,
        },
      });

      return NextResponse.json({
        ...result,
        reference,
        pricing: {
          providerCost,
          customerPrice,
          markup:
            Number(
              rates.education || 0
            ),
          quantity,
          profit:
            customerPrice -
            providerCost,
        },
      });
    }

    return NextResponse.json(
      {
        error:
          "Unsupported service type",
      },
      { status: 400 }
    );
  } catch (e: any) {
    const status =
      e instanceof WiseSubError
        ? e.status
        : e?.message === "UNAUTHORIZED"
        ? 401
        : e?.message ===
          "INSUFFICIENT_BALANCE"
        ? 400
        : 400;

    return NextResponse.json(
      {
        error:
          e.message ||
          "Purchase failed",
        details: e.details,
        reference,
      },
      { status }
    );
  }
}