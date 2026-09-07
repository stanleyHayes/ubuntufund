import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface BeneficiaryPayoutDocument extends Document {
  campaignId: string;
  beneficiaryId: string;
  recipientId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
  firstApprovedBy?: string;
  firstApprovedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Beneficiary payouts are single-transfer; NEEDS_REVIEW is unused here but part
// of the shared status enum.
const PAYOUT_STATUSES: PayoutStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REVERSED',
  'NEEDS_REVIEW',
];

const schema = new Schema<BeneficiaryPayoutDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    beneficiaryId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    provider: { type: String, enum: ['paystack'], required: true },
    providerRef: { type: String, unique: true, sparse: true },
    transferCode: { type: String },
    requestedBy: { type: String, required: true },
    approvedBy: { type: String },
  },
  { collection: 'beneficiary_payouts', timestamps: true }
);

export const BeneficiaryPayoutModel =
  mongoose.model<BeneficiaryPayoutDocument>('BeneficiaryPayout', schema);
