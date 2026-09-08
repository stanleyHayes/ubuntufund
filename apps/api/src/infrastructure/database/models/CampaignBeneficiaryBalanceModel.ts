import mongoose, { Schema, type Document } from 'mongoose';

export interface CampaignBeneficiaryBalanceDocument extends Document {
  campaignId: string;
  beneficiaryId: string;
  currency: string;
  pendingBalance: number;
  availableBalance: number;
  paidOutBalance: number;
  settledRefs: string[];
  updatedAt: Date;
}

const schema = new Schema<CampaignBeneficiaryBalanceDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    beneficiaryId: { type: String, required: true },
    currency: { type: String, required: true },
    pendingBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    paidOutBalance: { type: Number, default: 0 },
    settledRefs: { type: [String], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: 'campaign_beneficiary_balances', timestamps: false }
);

// One balance row per (campaign, beneficiary, currency).
schema.index({ campaignId: 1, beneficiaryId: 1, currency: 1 }, { unique: true });

export const CampaignBeneficiaryBalanceModel =
  mongoose.model<CampaignBeneficiaryBalanceDocument>(
    'CampaignBeneficiaryBalance',
    schema
  );
