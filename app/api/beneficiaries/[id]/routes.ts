import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { Beneficiary } from "@/lib/models";

/* =========================================================
   BENEFICIARY TYPE
   ========================================================= */

type BeneficiaryResult = {
  _id: unknown;
  name: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

/* =========================================================
   PATCH — RENAME BENEFICIARY
   ========================================================= */

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Beneficiary ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json();

    const name = String(body?.name || "").trim();

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

    await db();

    const beneficiary = (await Beneficiary.findOneAndUpdate(
      {
        _id: id,
        userId,
        isActive: true,
      },
      {
        $set: {
          name,
        },
      },
      {
        new: true,
      }
    ).lean()) as BeneficiaryResult | null;

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Beneficiary updated successfully.",
      beneficiary: {
        id: String(beneficiary._id),
        name: beneficiary.name,
        bankCode: beneficiary.bankCode,
        bankName: beneficiary.bankName,
        accountNumber: beneficiary.accountNumber,
        accountName: beneficiary.accountName,
      },
    });
  } catch (error) {
    console.error("BENEFICIARY UPDATE ERROR:", error);

    return NextResponse.json(
      { error: "Unable to update beneficiary." },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE — REMOVE BENEFICIARY
   ========================================================= */

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await currentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Beneficiary ID is required." },
        { status: 400 }
      );
    }

    await db();

    const beneficiary = await Beneficiary.findOneAndUpdate(
      {
        _id: id,
        userId,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
        },
      },
      {
        new: true,
      }
    );

    if (!beneficiary) {
      return NextResponse.json(
        { error: "Beneficiary not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Beneficiary removed successfully.",
    });
  } catch (error) {
    console.error("BENEFICIARY DELETE ERROR:", error);

    return NextResponse.json(
      { error: "Unable to remove beneficiary." },
      { status: 500 }
    );
  }
}