import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyNin, verifyBvn } from "@/lib/provn";

const KYC_LOCK = "__PROVN_KYC_VERIFICATION_IN_PROGRESS__";

export async function POST(req: Request) {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let locked = false;

  try {
    const form = await req.formData();

    const type = String(form.get("type") || "").toLowerCase();
    const number = String(form.get("number") || "").replace(/\s/g, "");

    if (!["nin", "bvn"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid KYC type" },
        { status: 400 }
      );
    }

    if (!/^[0-9]{11}$/.test(number)) {
      return NextResponse.json(
        { error: "KYC number must be exactly 11 digits" },
        { status: 400 }
      );
    }

    await db();

    /*
     * ATOMIC KYC LOCK
     *
     * This route uses the exact same lock as the
     * dedicated NIN and BVN routes.
     *
     * Therefore /verify cannot run at the same time
     * as /nin or /bvn for the same customer.
     */
    const lock = await User.findOneAndUpdate(
      {
        _id: id,
        "kyc.status": { $ne: "VERIFIED" },
        "kyc.reference": { $ne: KYC_LOCK },
      },
      {
        $set: {
          "kyc.status": "VERIFYING",
          "kyc.type": type.toUpperCase(),
          "kyc.reference": KYC_LOCK,
        },
      },
      {
        new: true,
      }
    );

    if (!lock) {
      const existingUser = await User.findById(id).select("kyc");

      if (existingUser?.kyc?.status === "VERIFIED") {
        return NextResponse.redirect(
          new URL("/dashboard", req.url)
        );
      }

      return NextResponse.json(
        {
          error:
            "KYC verification is already in progress. Please wait.",
        },
        {
          status: 409,
        }
      );
    }

    locked = true;

    console.log("=== GENERIC KYC LOCK ACQUIRED ===");
    console.log({
      userId: String(id),
      type: type.toUpperCase(),
    });

    /*
     * PROVN is called exactly once after the
     * atomic lock has been acquired.
     */
    const result =
      type === "nin"
        ? await verifyNin(number)
        : await verifyBvn(number);

    console.log("=== PROVN KYC RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

    /*
     * PROVN succeeded.
     * Save the verified KYC information.
     */
    const reference = String(
      result?.data?.nin ||
        result?.data?.bvn ||
        number
    );

    const updatedUser = await User.findOneAndUpdate(
      {
        _id: id,
        "kyc.reference": KYC_LOCK,
      },
      {
        $set: {
          "kyc.status": "VERIFIED",
          "kyc.type": type.toUpperCase(),
          "kyc.reference": reference,
          "kyc.verifiedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedUser) {
      throw new Error(
        "KYC verification succeeded, but the KYC record could not be saved."
      );
    }

    if (updatedUser.kyc?.status !== "VERIFIED") {
      throw new Error(
        "KYC verification succeeded, but the KYC status could not be saved."
      );
    }

    locked = false;

    return NextResponse.redirect(
      new URL("/dashboard", req.url)
    );
  } catch (error: any) {
    console.error("=== KYC VERIFICATION ERROR ===");
    console.error(error);

    /*
     * Release the lock after a failed provider request
     * or failed database save.
     */
    if (locked) {
      try {
        await db();

        await User.findOneAndUpdate(
          {
            _id: id,
            "kyc.reference": KYC_LOCK,
          },
          {
            $set: {
              "kyc.status": "PENDING",
            },
            $unset: {
              "kyc.reference": "",
              "kyc.type": "",
              "kyc.verifiedAt": "",
            },
          }
        );

        console.log("=== GENERIC KYC LOCK RELEASED ===");
      } catch (cleanupError) {
        console.error(
          "GENERIC KYC LOCK CLEANUP ERROR:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error?.message ||
          "KYC verification failed",
      },
      {
        status: 400,
      }
    );
  }
  }
