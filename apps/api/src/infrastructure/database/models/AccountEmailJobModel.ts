import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  userId: { type: String, index: true },
  newsletterId: { type: String, index: true },
  purpose: { type: String, enum: ['recovery', 'verification', 'password_changed', 'newsletter_confirmation', 'data_rights_response'], default: 'recovery' },
  tokenHash: { type: String, required: true, unique: true },
  authVersion: { type: String, default: '' },
  emailHash: { type: String, required: true },
  encryptedPayload: { type: String, select: false },
  status: { type: String, enum: ['pending', 'sent', 'suppressed'], default: 'pending' },
  expiresAt: { type: Date, required: true, expires: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date,
  leaseToken: String,
  attempts: { type: Number, default: 0 },
  lastError: String,
}, { timestamps: true });
schema.index({ status: 1, nextAttemptAt: 1 });
export const AccountEmailJobModel = mongoose.model('AccountEmailJob', schema);
