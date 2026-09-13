import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  providerCleanupPending: { type: Boolean, default: true, index: true },
  userId: { type: String, required: true, index: true },
  blockedUserId: { type: String, required: true, index: true },
}, { timestamps: true });
schema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
export const UserBlockModel = mongoose.model('UserBlock', schema);
