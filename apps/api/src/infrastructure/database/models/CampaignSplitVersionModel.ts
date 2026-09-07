import mongoose, { Schema, type Document } from 'mongoose';
import type {
  BeneficiaryAllocation,
  BeneficiaryConsentStatus,
  SplitStatus,
} from '@ubuntu-fund/types';

export interface CampaignSplitVersionDocument extends Document {
  campaignId: string;
  version: number;
  status: SplitStatus;
  allocations: BeneficiaryAllocation[];
  locked: boolean;
  lockedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SPLIT_STATUSES: SplitStatus[] = ['draft', 'active', 'superseded'];
const CONSENT_STATUSES: BeneficiaryConsentStatus[] = [
  'pending',
  'accepted',
  'declined',
];

const allocationSchema = new Schema<BeneficiaryAllocation>(
  {
    beneficiaryId: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    shareBps: { type: Number, required: true },
    consent: { type: String, enum: CONSENT_STATUSES, default: 'pending' },
    consentAt: { type: Date },
  },
  { _id: false }
);

const campaignSplitVersionSchema = new Schema<CampaignSplitVersionDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    status: {
      type: String,
      enum: SPLIT_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },
    allocations: { type: [allocationSchema], required: true },
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  { collection: 'campaign_split_versions', timestamps: true }
);

// One document per (campaign, version) — amendments increment the version.
campaignSplitVersionSchema.index({ campaignId: 1, version: 1 }, { unique: true });

export const CampaignSplitVersionModel = mongoose.model<CampaignSplitVersionDocument>(
  'CampaignSplitVersion',
  campaignSplitVersionSchema
);
