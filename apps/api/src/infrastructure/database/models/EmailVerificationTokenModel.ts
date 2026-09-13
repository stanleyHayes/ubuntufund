import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  emailHash: { type: String, required: true },
  authVersion: { type: String, default: '' },
  expiresAt: { type: Date, required: true, expires: 0 },
  usedAt: Date,
}, { timestamps: true });
export const EmailVerificationTokenModel = mongoose.model('EmailVerificationToken', schema);
