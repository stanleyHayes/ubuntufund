import mongoose, { Schema, type Document } from 'mongoose';

export interface AffiliateBalanceDocument extends Document {
  affiliateId: string;
  currency: string;
  totalEarned: number;
  pendingBalance: number;
  availableBalance: number;
  paidOutBalance: number;
  /** Applied settlement keys (G5 idempotency): a payout bucket move runs at most once per key. */
  settledRefs?: string[];
  updatedAt: Date;
}

const affiliateBalanceSchema = new Schema<AffiliateBalanceDocument>(
  {
    affiliateId: { type: String, required: true, unique: true },
    currency: { type: String, required: true },
    totalEarned: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    paidOutBalance: { type: Number, default: 0 },
    settledRefs: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'affiliatebalances', timestamps: false }
);

export const AffiliateBalanceModel = mongoose.model<AffiliateBalanceDocument>(
  'AffiliateBalance',
  affiliateBalanceSchema
);
