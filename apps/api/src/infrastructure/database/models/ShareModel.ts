import mongoose, { Schema, type Document } from 'mongoose';

export interface ShareDocument extends Document {
  campaignId: string;
  userId: string;
  platform?: string;
  createdAt: Date;
}

const shareSchema = new Schema<ShareDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    platform: { type: String },
  },
  { timestamps: true }
);

export const ShareModel = mongoose.model<ShareDocument>(
  'Share',
  shareSchema
);
