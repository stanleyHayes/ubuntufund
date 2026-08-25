import mongoose, { Schema, type Document } from 'mongoose';
import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
} from '@ubuntu-fund/types';

export interface CampaignDocument extends Document {
  slug?: string;
  title: string;
  description: string;
  goalAmount: number;
  raisedAmount: number;
  currency: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  creatorId: string;
  beneficiaries: string[];
  imageUrls: string[];
  startDate: Date;
  endDate: Date;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<CampaignDocument>(
  {
    // Vanity handle: unique + lowercase. Sparse so legacy campaigns without a
    // slug don't collide on the unique index.
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    goalAmount: { type: Number, required: true },
    raisedAmount: { type: Number, default: 0 },
    currency: { type: String, required: true, default: 'GHS' },
    category: {
      type: String,
      enum: Object.values(CampaignCategory),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(CampaignPriority),
      default: CampaignPriority.NORMAL,
    },
    status: {
      type: String,
      enum: Object.values(CampaignStatus),
      default: CampaignStatus.PENDING_REVIEW,
      index: true,
    },
    creatorId: { type: String, required: true, index: true },
    beneficiaries: [{ type: String }],
    imageUrls: [{ type: String }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    deletedAt: { type: Date, index: true },
    deletedBy: { type: String },
  },
  { timestamps: true }
);

export const CampaignModel = mongoose.model<CampaignDocument>(
  'Campaign',
  campaignSchema
);
