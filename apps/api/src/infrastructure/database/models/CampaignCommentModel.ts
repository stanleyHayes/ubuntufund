import mongoose, { Schema, type Document } from 'mongoose';

export interface CampaignCommentDocument extends Document {
  campaignId: string;
  authorId: string;
  content: string;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const campaignCommentSchema = new Schema<CampaignCommentDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    authorId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 1000 },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

campaignCommentSchema.index({ campaignId: 1, deletedAt: 1, createdAt: -1 });

export const CampaignCommentModel = mongoose.model<CampaignCommentDocument>('CampaignComment', campaignCommentSchema);
