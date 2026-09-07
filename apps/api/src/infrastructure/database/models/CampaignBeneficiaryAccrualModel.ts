import mongoose, { Schema, type Document } from 'mongoose';

export interface AccrualEntry {
  beneficiaryId: string;
  amount: number;
}

export interface CampaignBeneficiaryAccrualDocument extends Document {
  campaignId: string;
  donationIntentId: string;
  splitVersion: number;
  currency: string;
  entries: AccrualEntry[];
  reversed: boolean;
  createdAt: Date;
}

const entrySchema = new Schema<AccrualEntry>(
  { beneficiaryId: { type: String, required: true }, amount: { type: Number, required: true } },
  { _id: false }
);

const schema = new Schema<CampaignBeneficiaryAccrualDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    // Unique: the split of a settled donation is recorded exactly once, so a
    // retried settlement can never double-accrue to the beneficiary buckets.
    donationIntentId: { type: String, required: true, unique: true },
    splitVersion: { type: Number, required: true },
    currency: { type: String, required: true },
    entries: { type: [entrySchema], required: true },
    reversed: { type: Boolean, default: false },
  },
  { collection: 'campaign_beneficiary_accruals', timestamps: { createdAt: true, updatedAt: false } }
);

export const CampaignBeneficiaryAccrualModel =
  mongoose.model<CampaignBeneficiaryAccrualDocument>(
    'CampaignBeneficiaryAccrual',
    schema
  );
