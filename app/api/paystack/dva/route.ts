import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { User } from "@/lib/models";

async function paystackRequest(
  path: string,
  body: any
) {
  const response = await fetch(
    "https://api.paystack.co" + path,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${process.env.PAYSTACK_SECRET_KEY || ""}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const text = await response.text();

  let result: any = {};

  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      "Paystack returned an invalid response."
    );
  }

  if (!response.ok || !result.status) {
    throw new Error(
      result.message ||
        "Paystack DVA request failed"
    );
  }

  return result;
}

export async function POST(req: Request) {
  try {
    const id = await currentUserId();

    if (!id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    await db();

    const user: any =
  await User.findById(id).lean();

    if (!user) {
      return NextResponse.json(
        {
          error: "User not found",
        },
        { status: 404 }
      );
    }

console.log("=== DVA USER RAW CHECK ===");

console.log({
  idFromSession: String(id),
  mongoUserId: user ? String(user._id) : null,
  email: user?.email,
  name: user?.name,
  hasKyc: !!user?.kyc,
  fullKyc: user?.kyc,
});

const rawUser = await User.findById(id).lean();

console.log("=== DVA LEAN USER CHECK ===");
console.log(JSON.stringify(rawUser, null, 2))

console.log("=== DVA KYC CHECK ===");
console.log({
  userId: String(user._id),
  kycStatus: user.kyc?.status,
  kycType: user.kyc?.type,
  kycReference: user.kyc?.reference,
});

    /*
     * Customer must complete KYC first.
     */
    if (user.kyc?.status !== "VERIFIED") {
      return NextResponse.json(
        {
          error:
            "Please complete your NIN or BVN verification first.",
        },
        { status: 403 }
      );
    }

    /*
     * Already has an account.
     */
    if (user.kyc?.accountNumber) {
      return NextResponse.json({
        success: true,
        pending: false,
        accountNumber:
          user.kyc.accountNumber,
        accountName:
          user.kyc.accountName || "",
        bankName:
          user.kyc.bankName || "",
        customerCode:
          user.kyc.customerCode || "",
        dvaStatus:
          user.kyc.dvaStatus || "ACTIVE",
      });
    }

    /*
     * Build customer's name.
     */
    const names = String(
      user.name || ""
    )
      .trim()
      .split(/\s+/);

    const firstName =
      names.shift() || "Customer";

    const lastName =
      names.join(" ") || firstName;

    const phone = String(
      user.phone ||
        user.phoneNumber ||
        ""
    ).trim();

    if (!phone) {
      return NextResponse.json(
        {
          error:
            "Your phone number is missing from your profile.",
        },
        { status: 400 }
      );
    }

    const email = String(
      user.email || ""
    ).trim();

    if (!email) {
      return NextResponse.json(
        {
          error:
            "Your email address is missing from your profile.",
        },
        { status: 400 }
      );
    }

console.log("=== KYC SCHEMA DETAILS ===");

console.log("kyc path:", User.schema.path("kyc"));
console.log(
  "kyc.status path:",
  User.schema.path("kyc.status")
);
console.log(
  "kyc.reference path:",
  User.schema.path("kyc.reference")
);
console.log(
  "kyc.type path:",
  User.schema.path("kyc.type")
);

    /*
     * Paystack DVA assignment request.
     */
    const body: any = {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      country: "NG",
      preferred_bank:
        process.env.PAYSTACK_DVA_BANK ||
        "titan-paystack",
    };

    /*
     * If BVN was used for KYC,
     * pass it to Paystack.
     */
    if (
      user.kyc?.type === "BVN" &&
      user.kyc?.reference
    ) {
      body.bvn =
        String(user.kyc.reference).trim();
    }

    const result =
      await paystackRequest(
        "/dedicated_account/assign",
        body
      );

    console.log(
      "=== PAYSTACK DVA ASSIGN RESPONSE ==="
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    /*
     * Paystack can return:
     *
     * Assign dedicated account in progress
     *
     * with data = null.
     *
     * The actual account will then arrive
     * through dedicatedaccount.assign.success.
     */
    if (!result.data) {
      await User.findByIdAndUpdate(
        id,
        {
          $set: {
            "kyc.dvaStatus":
              "PENDING",
          },
        }
      );

      return NextResponse.json({
        success: true,
        pending: true,
        accountNumber: null,
        accountName: null,
        bankName: null,
        customerCode: null,
        message:
          result.message ||
          "Your account is being generated. Please wait a moment and refresh.",
      });
    }

    const data = result.data;

    const accountNumber =
      String(
        data.account_number ||
          data.accountNumber ||
          ""
      ).trim();

    const accountName =
      String(
        data.account_name ||
          data.accountName ||
          ""
      ).trim();

    const bankName =
      String(
        data.bank?.name ||
          data.bank_name ||
          data.bankName ||
          ""
      ).trim();

    const customerCode =
      String(
        data.customer?.customer_code ||
          data.customer_code ||
          ""
      ).trim();

    /*
     * Account was returned immediately.
     */
    if (accountNumber) {
      await User.findByIdAndUpdate(
        id,
        {
          $set: {
            "kyc.accountNumber":
              accountNumber,

            "kyc.accountName":
              accountName,

            "kyc.bankName":
              bankName,

            "kyc.customerCode":
              customerCode,

            "kyc.dvaStatus":
              "ACTIVE",
          },
        }
      );

      return NextResponse.json({
        success: true,
        pending: false,
        accountNumber,
        accountName,
        bankName,
        customerCode,
        dvaStatus: "ACTIVE",
        message:
          result.message ||
          "Your account has been generated successfully.",
      });
    }

    /*
     * Paystack returned data but no account number.
     * Keep it pending.
     */
    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          "kyc.dvaStatus":
            "PENDING",
        },
      }
    );

    return NextResponse.json({
      success: true,
      pending: true,
      accountNumber: null,
      accountName: null,
      bankName: null,
      customerCode:
        customerCode || null,
      message:
        "Your account is still being generated. Please wait a moment.",
    });
  } catch (error: any) {
    console.error(
      "=== PAYSTACK DVA ERROR ==="
    );

    console.error(error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to generate your account.",
      },
      { status: 502 }
    );
  }
}