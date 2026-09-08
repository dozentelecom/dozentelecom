import { NextResponse } from "next/server";
import {
  smeapi,
  ProviderError,
  arrays,
} from "@/lib/smeapi";

export async function GET() {
  try {
    const raw = await smeapi.dataPlans();

    const plans = arrays(raw, [
      "data",
      "data_plans",
      "plans",
      "results",
    ]);

    /*
     * Build service types directly from the plans returned
     * by SMEAPI.
     *
     * Example:
     *
     * MTN
     *   SME
     *   Sharecoupon
     *
     * Airtel
     *   SME
     *   Corporate
     */

    const serviceTypesByNetwork: Record<
      string,
      {
        networkId: string;
        network: string;
        serviceTypes: string[];
      }
    > = {};

    for (const plan of plans) {
      const networkId = String(
        plan?.network_id ??
          plan?.networkId ??
          ""
      ).trim();

      const networkName = String(
        plan?.network ??
          plan?.network_name ??
          ""
      ).trim();

      const serviceType = String(
        plan?.type ??
          plan?.service_type ??
          plan?.serviceType ??
          ""
      ).trim();

      if (!networkId || !serviceType) {
        continue;
      }

      if (!serviceTypesByNetwork[networkId]) {
        serviceTypesByNetwork[networkId] = {
          networkId,
          network: networkName || networkId,
          serviceTypes: [],
        };
      }

      if (
        !serviceTypesByNetwork[
          networkId
        ].serviceTypes.includes(serviceType)
      ) {
        serviceTypesByNetwork[
          networkId
        ].serviceTypes.push(serviceType);
      }
    }

    return NextResponse.json({
      success: true,
      plans,

      /*
       * New data used by Provider Controls.
       */
      serviceTypesByNetwork,

      raw,
    });
  } catch (e: any) {
    const status =
      e instanceof ProviderError
        ? e.status
        : 502;

    return NextResponse.json(
      {
        error:
          e?.message ||
          "Unable to load SME data plans",
        details:
          e instanceof ProviderError
            ? e.details
            : undefined,
      },
      { status }
    );
  }
}