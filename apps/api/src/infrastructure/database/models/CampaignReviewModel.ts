import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  campaignId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  version: { type: String, required: true },
  actorId: { type: String, required: true },
  action: { type: String, enum: ['approve', 'reject', 'block', 'reopen'], required: true },
  reason: { type: String, required: true, maxlength: 2000 },
  contentReviewed: Boolean,
  fundraisingReviewed: Boolean,
  beforeStatus: { type: String, required: true },
  afterStatus: { type: String, required: true },
  snapshot: { type: Schema.Types.Mixed, required: true },
  snapshotErasedAt: Date,
}, { timestamps: true });
schema.index({ campaignId: 1, version: 1 }, { unique: true });
export const CampaignReviewModel = mongoose.model('CampaignReview', schema);
