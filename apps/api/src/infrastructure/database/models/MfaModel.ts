import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  userId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  secretCipher: { type: String, required: true },
  enrollmentId: { type: String, required: true },
  enrollmentAuthVersion: { type: String, default: '' },
  expiresAt: Date,
  lastCounter: { type: Number, default: -1 },
  recoveryHashes: { type: [String], default: [] },
  attempts: { type: Number, default: 0 },
  windowUntil: { type: Date, default: () => new Date(0) },
}, { timestamps: true });
// Only pending enrollments expire. Enabling removes expiresAt atomically.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const MfaModel = mongoose.model('Mfa', schema);
