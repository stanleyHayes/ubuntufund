import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutProvider, PayoutStatus, PayoutType } from '@ubuntu-fund/types';

export interface PayoutDocument extends Document {
  campaignId: string;
  recipientId: string;
  amount: number;
  type: PayoutType;
  fee: number;
  netAmount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
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

const payoutSchema = new Schema<PayoutDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, default: 'standard' },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number },
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
  },
  { collection: 'payouts', timestamps: true }
);

export const PayoutModel = mongoose.model<PayoutDocument>('Payout', payoutSchema);
