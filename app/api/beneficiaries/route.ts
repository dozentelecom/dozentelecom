import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { Beneficiary } from "@/lib/models";


/* =========================================================
   GET — LIST CUSTOMER BENEFICIARIES
   ========================================================= */

export async function GET() {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await db();

    const beneficiaries = await Beneficiary.find({
      userId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      beneficiaries: beneficiaries.map((item: any) => ({
        id: String(item._id),
        name: item.name,
        bankCode: item.bankCode,
        bankName: item.bankName,
        accountNumber: item.accountNumber,
        accountName: item.accountName,
        lastVerifiedAt: item.lastVerifiedAt,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("BENEFICIARIES GET ERROR:", error);

    return NextResponse.json(
      { error: "Unable to load beneficiaries." },
      { status: 500 }
    );
  }
}


/* =========================================================
   POST — SAVE BENEFICIARY
   ========================================================= */

export async function POST(req: Request) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();
    const bankCode = String(body?.bankCode || "").trim();
    const bankName = String(body?.bankName || "").trim();
    const accountNumber = String(
      body?.accountNumber || ""
    ).trim();
    const accountName = String(
      body?.accountName || ""
    ).trim();

    /* =========================
       VALIDATION
       ========================= */

    if (!name) {
      return NextResponse.json(
        { error: "Beneficiary name is required." },
        { status: 400 }
      );
    }

    if (name.length > 50) {
      return NextResponse.json(
        { error: "Beneficiary name is too long." },
        { status: 400 }
      );
    }

    if (!bankCode) {
      return NextResponse.json(
        { error: "Bank code is required." },
        { status: 400 }
      );
    }

    if (!bankName) {
      return NextResponse.json(
        { error: "Bank name is required." },
        { status: 400 }
      );
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      return NextResponse.json(
        {
          error:
            "Account number must contain exactly 10 digits.",
        },
        { status: 400 }
      );
    }

    if (!accountName) {
      return NextResponse.json(
        { error: "Account name is required." },
        { status: 400 }
      );
    }

    await db();

    /* =========================
       DUPLICATE CHECK
       ========================= */

    const existing = await Beneficiary.findOne({
      userId,
      bankCode,
      accountNumber,
    }).lean();

    if (existing) {
      return NextResponse.json(
        {
          error:
            "This bank account has already been saved.",
        },
        { status: 409 }
      );
    }

    /* =========================
       CREATE
       ========================= */

    const beneficiary = await Beneficiary.create({
      userId,
      name,
      bankCode,
      bankName,
      accountNumber,
      accountName,
      lastVerifiedAt: new Date(),
      isActive: true,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Beneficiary saved successfully.",
        beneficiary: {
          id: String(beneficiary._id),
          name: beneficiary.name,
          bankCode: beneficiary.bankCode,
          bankName: beneficiary.bankName,
          accountNumber: beneficiary.accountNumber,
          accountName: beneficiary.accountName,
          lastVerifiedAt: beneficiary.lastVerifiedAt,
          createdAt: beneficiary.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("BENEFICIARY CREATE ERROR:", error);

    /* Mongo duplicate-key protection */
    if (error?.code === 11000) {
      return NextResponse.json(
        {
          error:
            "This bank account has already been saved.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Unable to save beneficiary." },
      { status: 500 }
    );
  }
}