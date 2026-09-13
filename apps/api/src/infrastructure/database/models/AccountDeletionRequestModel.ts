import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: String, required: true, unique: true },
  contactEmail: { type: String, required: true },
  mediaUrls: { type: [String], default: [] },
  status: { type: String, enum: ['pending', 'review_required'], default: 'pending', index: true },
  requestedAt: { type: Date, default: Date.now },
  coreRemovedAt: Date,
  reviewNotes: { type: String, default: '' },
  nextReviewAt: { type: Date, required: true },
  reviewedBy: String,
  reviewedAt: Date,
}, { timestamps: true });
export const AccountDeletionRequestModel = mongoose.model('AccountDeletionRequest', schema);
