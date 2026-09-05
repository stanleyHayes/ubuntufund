import mongoose, { Schema, type Document } from 'mongoose';
import { AffiliateStatus, type PayoutRecipientType } from '@ubuntu-fund/types';

export interface AffiliateDocument extends Document {
  userId: string;
  referralCode: string;
  status: AffiliateStatus;
  commissionRate: number;
  recipientCode?: string;
  recipientType?: PayoutRecipientType;
  accountNumber?: string;
  bankCode?: string;
  accountName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RECIPIENT_TYPES: PayoutRecipientType[] = ['ghipss', 'mobile_money'];

const affiliateSchema = new Schema<AffiliateDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    // Lowercased so a referral code resolves case-insensitively; unique + indexed
    // so a code maps to exactly one affiliate (the resolve-at-signup lookup).
    referralCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: Object.values(AffiliateStatus),
      required: true,
      default: AffiliateStatus.ACTIVE,
    },
    commissionRate: { type: Number, required: true },
    // Paystack payout destination — optional until SetAffiliatePayoutRecipient.
    recipientCode: { type: String },
    recipientType: { type: String, enum: RECIPIENT_TYPES },
    accountNumber: { type: String },
    bankCode: { type: String },
    accountName: { type: String },
  },
  { collection: 'affiliates', timestamps: true }
);

export const AffiliateModel = mongoose.model<AffiliateDocument>(
  'Affiliate',
  affiliateSchema
);
