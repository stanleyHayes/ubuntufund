import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  actorId: { type: String, required: true, index: true },
  fingerprint: { type: String, required: true, unique: true },
  action: { type: String, enum: ['live.start', 'account.profile', 'organization.profile', 'creator.profile', 'campaign.create', 'campaign.slug', 'comment.create', 'update.create', 'update.edit'], required: true },
  resourceId: { type: String, required: true },
  baseVersion: String,
  consumptionWriteVersion: { type: Number, default: 0 },
  text: { type: String, required: true, maxlength: 12000 },
  mediaUrls: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reason: { type: String, enum: ['staff_requested', 'media', 'screening', 'flagged', 'unavailable'], required: true },
  automatedConsentAt: Date,
  reviewedBy: String,
  reviewedAt: Date,
  reviewNotes: String,
  approvalExpiresAt: Date,
  purgeAt: { type: Date, default: () => new Date(Date.now() + 30 * 86400000) },
}, { timestamps: true });
schema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
export const PublicationReviewModel = mongoose.model('PublicationReview', schema);
