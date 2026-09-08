import mongoose, { Schema, models, model } from "mongoose";

/* =========================================================
   KYC SCHEMA
   ========================================================= */

const KycSchema = new Schema(
  {
    status: {
      type: String,
      default: "PENDING",
    },

    type: {
      type: String,
    },

    reference: {
      type: String,
    },

    verifiedAt: {
      type: Date,
    },

    accountNumber: {
      type: String,
    },

    accountName: {
      type: String,
    },

    bankName: {
      type: String,
    },

    customerCode: {
      type: String,
    },

    dvaStatus: {
      type: String,
    },
  },
  {
    _id: false,
  }
);


/* =========================================================
   USER
   ========================================================= */

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      index: true,
    },

    phone: {
      type: String,
    },

    phoneNumber: {
      type: String,
    },

    passwordHash: String,

    pinHash: String,

    pinCreatedAt: Date,

    role: {
      type: String,
      default: "customer",
    },

    /* =========================
       KYC
       ========================= */

    kyc: {
      type: KycSchema,
      default: () => ({}),
    },

    /* =========================
       PASSWORD RESET
       ========================= */

    resetPasswordTokenHash: String,

    resetPasswordExpires: Date,

    resetPasswordCodeHash: String,

    resetPasswordCodeExpires: Date,

    /* =========================
       PIN RESET
       ========================= */

    resetPinTokenHash: String,

    resetPinExpires: Date,

    failedPinAttempts: {
      type: Number,
      default: 0,
    },

    pinLockedUntil: Date,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   WALLET
   ========================================================= */

const WalletSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      unique: true,
      index: true,
    },

    balanceKobo: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "NGN",
    },
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   LEDGER
   ========================================================= */

const LedgerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    type: String,

    amountKobo: Number,

    balanceAfterKobo: Number,

    reference: {
      type: String,
      unique: true,
    },

    status: String,

    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   TRANSACTION
   ========================================================= */

const TxSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    service: String,

    status: String,

    providerTransactionId: String,

    externalReference: {
      type: String,
      unique: true,
    },

    amountKobo: Number,

    costKobo: Number,

    profitKobo: Number,

    metadata: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   SETTINGS
   ========================================================= */

const SettingsSchema = new Schema(
  {
    key: {
      type: String,
      unique: true,
      index: true,
    },

    rates: {
      data: Number,
      electricity: Number,
      cable: Number,
      education: Number,
      airtimeToCash: Number,
      funding: Number,
      withdrawal: Number,
      airtimeRoundUnit: Number,
    },
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   AIRTIME TO CASH
   ========================================================= */

const ATCSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    network: String,

    airtimeAmountKobo: Number,

    rate: Number,

    payoutKobo: Number,

    senderPhone: String,

    bankName: String,

    accountNumber: String,

    accountName: String,

    status: {
      type: String,
      default: "PENDING",
    },

    reference: {
      type: String,
      unique: true,
    },

    notes: String,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   FUNDING
   ========================================================= */

const FundingSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    reference: {
      type: String,
      unique: true,
    },

    grossKobo: Number,

    feeKobo: Number,

    creditKobo: Number,

    status: String,

    paystackReference: String,

    providerData: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   PROFIT WITHDRAWAL
   ========================================================= */

const ProfitWithdrawalSchema = new Schema(
  {
    reference: {
      type: String,
      unique: true,
      index: true,
    },

    amountKobo: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "REVERSED",
      ],
      default: "PENDING",
      index: true,
    },

    recipientCode: String,

    bankName: String,

    accountNumber: String,

    accountName: String,

    bankCode: String,

    paystackReference: String,

    paystackTransferCode: String,

    paystackData: Schema.Types.Mixed,

    reason: String,

    error: String,

    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    completedAt: Date,
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   GIVEAWAY
   ========================================================= */

const GiveawaySchema = new Schema(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["AIRTIME", "DATA"],
      required: true,
    },

    network: {
      type: Number,
      required: true,
    },

    /* Airtime amount in Naira */
    airtimeAmount: {
      type: Number,
    },

    /* Data plan ID */
    dataPlan: {
      type: Number,
    },

    /* Data plan name shown to recipients */
    dataPlanName: {
      type: String,
    },

    /* Provider cost at time giveaway was created */
    providerCostKobo: {
      type: Number,
      required: true,
    },

    /* Price charged/reserved from creator wallet per recipient */
    rewardPriceKobo: {
      type: Number,
      required: true,
    },

    recipientLimit: {
      type: Number,
      required: true,
      min: 1,
    },

    claimedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ],
      default: "ACTIVE",
      index: true,
    },

    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);


/* =========================================================
   GIVEAWAY CLAIM
   ========================================================= */

const GiveawayClaimSchema = new Schema(
  {
    giveawayId: {
      type: Schema.Types.ObjectId,
      ref: "Giveaway",
      required: true,
      index: true,
    },

    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["AIRTIME", "DATA"],
      required: true,
    },

    network: {
      type: Number,
      required: true,
    },

    amountKobo: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "PROCESSING",
        "SUCCESS",
        "FAILED",
      ],
      default: "PROCESSING",
      index: true,
    },

    providerReference: {
      type: String,
    },

    providerResponse: {
      type: Schema.Types.Mixed,
    },

    error: {
      type: String,
    },

    claimedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);


/*
 * VERY IMPORTANT:
 *
 * The same phone number can only claim once
 * from the same giveaway.
 *
 * This also protects against two simultaneous
 * claim requests.
 */
GiveawayClaimSchema.index(
  {
    giveawayId: 1,
    phone: 1,
  },
  {
    unique: true,
  }
);

/* =========================================================
   CUSTOMER WITHDRAWAL
   ========================================================= */

const WithdrawalSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /* Amount customer requested */
    amountKobo: {
      type: Number,
      required: true,
      min: 1,
    },

    /* Withdrawal fee */
    feeKobo: {
      type: Number,
      required: true,
      min: 0,
    },

    /* Amount actually sent to customer */
    payoutKobo: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "REVERSED",
      ],
      default: "PENDING",
      index: true,
    },

    /* Nigerian bank information */
    bankCode: {
      type: String,
      required: true,
    },

    bankName: {
      type: String,
      required: true,
    },

    accountNumber: {
      type: String,
      required: true,
    },

    accountName: {
      type: String,
      required: true,
    },

    /* Paystack recipient */
    recipientCode: {
      type: String,
    },

    /* Paystack transfer */
    paystackReference: {
      type: String,
      index: true,
    },

    paystackTransferCode: {
      type: String,
    },

    paystackData: {
      type: Schema.Types.Mixed,
    },

    reason: {
      type: String,
    },

    error: {
      type: String,
    },

    completedAt: {
      type: Date,
    },

    failedAt: {
      type: Date,
    },

    reversedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   NOTIFICATION
========================================================= */

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: [
        "GENERAL",
        "ANNOUNCEMENT",
        "TRANSACTION",
        "FUNDING",
        "SECURITY",
        "PROMOTION",
      ],
      default: "GENERAL",
    },

    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    link: {
      type: String,
      default: "",
    },

    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   MODELS
   ========================================================= */

export const User =
  models.User || model("User", UserSchema);

export const Wallet =
  models.Wallet || model("Wallet", WalletSchema);

export const Ledger =
  models.Ledger || model("Ledger", LedgerSchema);

export const Transaction =
  models.Transaction || model("Transaction", TxSchema);

export const Funding =
  models.Funding || model("Funding", FundingSchema);

export const AirtimeToCash =
  models.AirtimeToCash ||
  model("AirtimeToCash", ATCSchema);

export const Settings =
  models.Settings ||
  model("Settings", SettingsSchema);

export const Giveaway =
  models.Giveaway ||
  model("Giveaway", GiveawaySchema);

export const GiveawayClaim =
  models.GiveawayClaim ||
  model(
    "GiveawayClaim",
    GiveawayClaimSchema
  );

export const ProfitWithdrawal =
  models.ProfitWithdrawal ||
  model("ProfitWithdrawal", ProfitWithdrawalSchema);

export const Withdrawal =
  models.Withdrawal ||
  model("Withdrawal", WithdrawalSchema);

export const Notification =
  models.Notification ||
  model("Notification", NotificationSchema);