import mongoose, { Schema, type Document } from 'mongoose';

export interface CampaignBalanceDocument extends Document {
  campaignId: string;
  currency: string;
  totalRaised: number;
  pendingBalance: number;
  availableBalance: number;
  paidOutBalance: number;
  platformFees: number;
  processorFees: number;
  tips: number;
  updatedAt: Date;
}

const campaignBalanceSchema = new Schema<CampaignBalanceDocument>(
  {
    campaignId: { type: String, required: true, unique: true },
    currency: { type: String, required: true },
    totalRaised: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    paidOutBalance: { type: Number, default: 0 },
    platformFees: { type: Number, default: 0 },
    processorFees: { type: Number, default: 0 },
    tips: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'campaignbalances', timestamps: false }
);

export const CampaignBalanceModel = mongoose.model<CampaignBalanceDocument>(
  'CampaignBalance',
  campaignBalanceSchema
);
