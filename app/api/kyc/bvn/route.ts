import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyBvn } from "@/lib/provn";

const KYC_LOCK = "__PROVN_KYC_VERIFICATION_IN_PROGRESS__";

export async function POST(req: Request) {
  const id = await currentUserId();

  if (!id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  let locked = false;

  try {
    const ct = req.headers.get("content-type") || "";

    const body = ct.includes("form")
      ? Object.fromEntries((await req.formData()).entries())
      : await req.json();

    const bvn = String((body as any).bvn || "").replace(/\s/g, "");

    if (!/^\d{11}$/.test(bvn)) {
      return NextResponse.redirect(
        new URL(
          "/kyc?error=Enter%20a%20valid%2011-digit%20BVN",
          req.url
        )
      );
    }

    await db();

    /*
     * ATOMIC KYC LOCK
     *
     * This prevents:
     * - double-clicks
     * - browser retries
     * - simultaneous NIN/BVN requests
     * - another request reaching PROVN while one is running
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
          "kyc.type": "BVN",
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

      return NextResponse.redirect(
        new URL(
          "/kyc?error=KYC%20verification%20is%20already%20in%20progress.%20Please%20wait.",
          req.url
        )
      );
    }

    locked = true;

    console.log("=== BVN KYC LOCK ACQUIRED ===");
    console.log({
      userId: String(id),
      type: "BVN",
    });

    /*
     * IMPORTANT:
     * PROVN is called ONLY after the database lock
     * has been successfully acquired.
     */
    const result = await verifyBvn(bvn);

    console.log("=== BVN PROVIDER RESPONSE ===");
    console.log(JSON.stringify(result, null, 2));

    /*
     * PROVN succeeded.
     * Now save the actual verified KYC information.
     */
    const updatedUser: any = await User.findOneAndUpdate(
      {
        _id: id,
        "kyc.reference": KYC_LOCK,
      },
      {
        $set: {
          "kyc.status": "VERIFIED",
          "kyc.type": "BVN",
          "kyc.reference": bvn,
          "kyc.verifiedAt": new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    console.log("=== BVN KYC SAVED ===");
    console.log({
      userId: String(id),
      foundUser: !!updatedUser,
      kycStatus: updatedUser?.kyc?.status,
      kycType: updatedUser?.kyc?.type,
      hasKycReference: !!updatedUser?.kyc?.reference,
    });

    if (!updatedUser) {
      throw new Error(
        "BVN verification succeeded, but the KYC record could not be saved."
      );
    }

    if (updatedUser?.kyc?.status !== "VERIFIED") {
      throw new Error(
        "BVN verification succeeded, but the KYC status could not be saved."
      );
    }

    locked = false;

    return NextResponse.redirect(
      new URL("/dashboard", req.url)
    );
  } catch (error: any) {
    console.error("=== BVN KYC ERROR ===");
    console.error(error);

    /*
     * PROVN failed.
     *
     * Release the lock so the customer can retry later.
     * This does NOT make another PROVN request.
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

        console.log("=== BVN KYC LOCK RELEASED ===");
      } catch (cleanupError) {
        console.error(
          "BVN KYC LOCK CLEANUP ERROR:",
          cleanupError
        );
      }
    }

    return NextResponse.redirect(
      new URL(
        "/kyc?error=" +
          encodeURIComponent(
            error?.message || "BVN verification failed"
          ),
        req.url
      )
    );
  }
        }
