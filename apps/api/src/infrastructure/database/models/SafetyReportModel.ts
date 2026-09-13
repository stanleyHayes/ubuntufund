import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  reporterId: { type: String, required: true, index: true },
  targetType: { type: String, enum: ['comment', 'campaign_update', 'user', 'live', 'donation_message', 'tip_message', 'ai_output'], required: true },
  targetDigest: String,
  targetId: { type: String, required: true },
  targetUserId: { type: String },
  campaignId: String,
  reason: { type: String, required: true },
  description: { type: String, maxlength: 2000 },
  evidence: { type: String, maxlength: 16000 },
  priority: { type: String, enum: ['urgent', 'normal'], default: 'normal' },
  status: { type: String, enum: ['pending', 'resolved', 'dismissed'], default: 'pending', index: true },
  resolution: String,
  reviewAction: String,
  reviewStartedAt: Date,
  reviewNotes: String,
  reviewedBy: String,
  reviewedAt: Date,
}, { timestamps: true });
schema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
export const SafetyReportModel = mongoose.model('SafetyReport', schema);
