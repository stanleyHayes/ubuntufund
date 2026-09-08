import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface AffiliatePayoutDocument extends Document {
  affiliateId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
  /** G5: the terminal balance effect has been recorded as applied (reconciliation index). */
  settlementApplied?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PAYOUT_STATUSES: PayoutStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REVERSED',
];

const PAYOUT_PROVIDERS: PayoutProvider[] = ['paystack'];

const affiliatePayoutSchema = new Schema<AffiliatePayoutDocument>(
  {
    affiliateId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    provider: { type: String, enum: PAYOUT_PROVIDERS, required: true },
    // Unique + sparse: at most one payout per transfer reference, so a duplicate
    // transfer webhook can never correlate to two payouts.
    providerRef: { type: String, unique: true, sparse: true },
    transferCode: { type: String },
    requestedBy: { type: String, required: true, index: true },
    approvedBy: { type: String },
    settlementApplied: { type: Boolean, default: false, index: true },
  },
  { collection: 'affiliatepayouts', timestamps: true }
);

export const AffiliatePayoutModel = mongoose.model<AffiliatePayoutDocument>(
  'AffiliatePayout',
  affiliatePayoutSchema
);
