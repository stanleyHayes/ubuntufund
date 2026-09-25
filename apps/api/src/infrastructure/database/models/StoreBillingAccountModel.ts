import mongoose, { Schema } from 'mongoose';
import { randomUUID } from 'node:crypto';

/** Purchase-account binding; the UUID is never derived from an email or user ID. */
const schema = new Schema({
  userId: { type: String, required: true, unique: true },
  accountToken: { type: String, required: true, unique: true, default: () => randomUUID() },
  provider: { type: String, enum: ['apple', 'google', 'web'] },
  /** When the provider was last claimed; a recent claim may still have a payment in flight. */
  providerClaimedAt: Date,
  verificationRevision: { type: Number, required: true, default: 0 },
  appliedRevision: { type: Number, required: true, default: 0 },
}, { timestamps: true });

export const StoreBillingAccountModel = mongoose.model('StoreBillingAccount', schema);
