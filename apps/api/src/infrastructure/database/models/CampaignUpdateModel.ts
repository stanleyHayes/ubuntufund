import mongoose, { Schema, type Document } from 'mongoose';
import type { CampaignUpdateType } from '@ubuntu-fund/types';

export interface CampaignUpdateDocument extends Document {
  campaignId: string;
  authorId: string;
  title: string;
  content: string;
  type: CampaignUpdateType;
  mediaUrls: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const campaignUpdateSchema = new Schema<CampaignUpdateDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: {
      type: String,
      enum: ['milestone', 'general', 'thank_you', 'urgent'],
      default: 'general',
    },
    mediaUrls: [{ type: String }],
    isPinned: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const CampaignUpdateModel = mongoose.model<CampaignUpdateDocument>(
  'CampaignUpdate',
  campaignUpdateSchema
);
