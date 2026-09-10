
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

    type: String,

    reference: String,

    verifiedAt: Date,

    accountNumber: String,

    accountName: String,

    bankName: String,

    customerCode: String,

    dvaStatus: String,
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

    phone: String,

    phoneNumber: String,

    passwordHash: String,

    pinHash: String,

    pinCreatedAt: Date,

    role: {
      type: String,
      default: "customer",
    },

blocked: {
  type: Boolean,
  default: false,
  index: true,
},

    /* =========================
       VIP MEMBERSHIP
       ========================= */

    vipLevel: {
      type: String,
      enum: ["NORMAL", "VIP1", "VIP2", "VIP3"],
      default: "NORMAL",
      index: true,
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

    /*
     * IMPORTANT:
     *
     * rates contains both normal pricing settings
     * and provider controls.
     *
     * It MUST be Mixed so Mongo/Mongoose does not
     * strip nested provider-control objects.
     */
    rates: {
      type: Schema.Types.Mixed,
      default: {},
    },

    /* =========================
       VIP MEMBERSHIP PRICES
       ========================= */

    vip1Price: {
      type: Number,
      default: 5000,
    },

    vip2Price: {
      type: Number,
      default: 15000,
    },

    vip3Price: {
      type: Number,
      default: 30000,
    },

    /* =========================
       VIP1 SERVICE RATES
       ========================= */

    vip1Data: {
      type: Number,
      default: 4,
    },

    vip1Electricity: {
      type: Number,
      default: 3,
    },

    vip1Cable: {
      type: Number,
      default: 3,
    },

    vip1Education: {
      type: Number,
      default: 12,
    },

    vip1AirtimeToCash: {
      type: Number,
      default: 18,
    },

    /* =========================
       VIP2 SERVICE RATES
       ========================= */

    vip2Data: {
      type: Number,
      default: 3,
    },

    vip2Electricity: {
      type: Number,
      default: 2,
    },

    vip2Cable: {
      type: Number,
      default: 2,
    },

    vip2Education: {
      type: Number,
      default: 10,
    },

    vip2AirtimeToCash: {
      type: Number,
      default: 15,
    },

    /* =========================
       VIP3 SERVICE RATES
       ========================= */

    vip3Data: {
      type: Number,
      default: 2,
    },

    vip3Electricity: {
      type: Number,
      default: 1,
    },

    vip3Cable: {
      type: Number,
      default: 1,
    },

    vip3Education: {
      type: Number,
      default: 8,
    },

    vip3AirtimeToCash: {
      type: Number,
      default: 12,
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

    airtimeAmount: Number,

    dataPlan: Number,

    dataPlanName: String,

    providerCostKobo: {
      type: Number,
      required: true,
    },

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

    expiresAt: Date,
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

    providerReference: String,

    providerResponse: Schema.Types.Mixed,

    error: String,

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
 * Same phone can only claim once
 * from the same giveaway.
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

    amountKobo: {
      type: Number,
      required: true,
      min: 1,
    },

    feeKobo: {
      type: Number,
      required: true,
      min: 0,
    },

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

    recipientCode: String,

    paystackReference: {
      type: String,
      index: true,
    },

    paystackTransferCode: String,

    paystackData: Schema.Types.Mixed,

    reason: String,

    error: String,

    completedAt: Date,

    failedAt: Date,

    reversedAt: Date,
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

    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

/* =========================================================
   SAVED BENEFICIARY
   ========================================================= */

const BeneficiarySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    bankCode: {
      type: String,
      required: true,
      trim: true,
    },

    bankName: {
      type: String,
      required: true,
      trim: true,
    },

    accountNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{10}$/,
    },

    accountName: {
      type: String,
      required: true,
      trim: true,
    },

    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

BeneficiarySchema.index(
  {
    userId: 1,
    bankCode: 1,
    accountNumber: 1,
  },
  {
    unique: true,
  }
);

/* =========================================================
   ADMIN AUDIT LOG
   ========================================================= */

const AuditLogSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      index: true,
      required: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      required: true,
      index: true,
    },

    targetId: {
      type: String,
      index: true,
    },

    description: {
      type: String,
      required: true,
    },

    previousValue: {
      type: Schema.Types.Mixed,
    },

    newValue: {
      type: Schema.Types.Mixed,
    },

    ipAddress: {
      type: String,
    },

    userAgent: {
      type: String,
    },

    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

export const AuditLog =
  models.AuditLog ||
  model("AuditLog", AuditLogSchema);

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
  models.Transaction ||
  model("Transaction", TxSchema);

export const Funding =
  models.Funding ||
  model("Funding", FundingSchema);

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
  model("GiveawayClaim", GiveawayClaimSchema);

export const ProfitWithdrawal =
  models.ProfitWithdrawal ||
  model("ProfitWithdrawal", ProfitWithdrawalSchema);

export const Withdrawal =
  models.Withdrawal ||
  model("Withdrawal", WithdrawalSchema);

export const Notification =
  models.Notification ||
  model("Notification", NotificationSchema);

export const Beneficiary =
  models.Beneficiary ||
  model("Beneficiary", BeneficiarySchema);