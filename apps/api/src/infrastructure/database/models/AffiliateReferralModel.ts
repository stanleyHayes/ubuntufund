import mongoose, { Schema, type Document } from 'mongoose';
import type { AffiliateReferralStatus } from '@ubuntu-fund/types';

export interface AffiliateReferralDocument extends Document {
  referrerId: string;
  refereeId: string;
  referralCode: string;
  status: AffiliateReferralStatus;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const REFERRAL_STATUSES: AffiliateReferralStatus[] = ['pending', 'converted'];

const affiliateReferralSchema = new Schema<AffiliateReferralDocument>(
  {
    referrerId: { type: String, required: true, index: true },
    // Unique: a user is referred at most once, so the guarded pending → converted
    // update is the exactly-once gate for one-time commission accrual.
    refereeId: { type: String, required: true, unique: true, index: true },
    referralCode: { type: String, required: true },
    status: {
      type: String,
      enum: REFERRAL_STATUSES,
      required: true,
      default: 'pending',
    },
    convertedAt: { type: Date },
  },
  { collection: 'affiliatereferrals', timestamps: true }
);

export const AffiliateReferralModel = mongoose.model<AffiliateReferralDocument>(
  'AffiliateReferral',
  affiliateReferralSchema
);
