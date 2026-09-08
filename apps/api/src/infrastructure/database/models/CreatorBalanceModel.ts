import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A creator's tip-jar balance (buy-me-a-coffee). Mirrors CampaignBalance:
 * successful tips credit `availableBalance` (net of the platform fee); a
 * withdrawal reserves out of available → paidOut. `settledRefs` gives each
 * balance move at-most-once idempotency (same G5 mechanism).
 */
export interface CreatorBalanceDocument extends Document {
  userId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  paidOutBalance: number;
  totalReceived: number;
  platformFees: number;
  payoutFees: number;
  settledRefs: string[];
  updatedAt: Date;
}

const schema = new Schema<CreatorBalanceDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    currency: { type: String, required: true, default: 'GHS' },
    availableBalance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    paidOutBalance: { type: Number, default: 0 },
    totalReceived: { type: Number, default: 0 },
    platformFees: { type: Number, default: 0 },
    payoutFees: { type: Number, default: 0 },
    settledRefs: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'creator_balances', timestamps: false }
);

export const CreatorBalanceModel = mongoose.model<CreatorBalanceDocument>(
  'CreatorBalance',
  schema
);
