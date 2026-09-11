import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface CreatorPayoutDocument extends Document {
  creatorUserId: string;
  amount: number;
  fee?: number;
  feePercent?: number;
  netAmount?: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  /** Client-supplied idempotency key; unique so a retried POST cannot pay twice. */
  requestKey?: string;
  transferCode?: string;
  recipientCode?: string;
  recipientName?: string;
  /** G5/G7 durability: terminal effect applied + which status a reversal came from. */
  settlementApplied?: boolean;
  reversedFrom?: 'PAID' | 'PROCESSING';
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

const schema = new Schema<CreatorPayoutDocument>(
  {
    creatorUserId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    fee: Number, feePercent: Number, netAmount: Number,
    currency: { type: String, required: true, default: 'GHS' },
    status: { type: String, enum: PAYOUT_STATUSES, required: true, default: 'PENDING', index: true },
    provider: { type: String, default: 'paystack' },
    providerRef: { type: String, unique: true, sparse: true },
    requestKey: { type: String, unique: true, sparse: true },
    transferCode: { type: String },
    recipientCode: { type: String },
    recipientName: { type: String },
    settlementApplied: { type: Boolean, default: false, index: true },
    reversedFrom: { type: String, enum: ['PAID', 'PROCESSING'] },
  },
  { collection: 'creator_payouts', timestamps: true }
);

export const CreatorPayoutModel = mongoose.model<CreatorPayoutDocument>(
  'CreatorPayout',
  schema
);
