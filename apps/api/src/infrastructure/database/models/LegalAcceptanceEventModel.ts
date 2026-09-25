import mongoose, { Schema } from 'mongoose';

/**
 * Insert-only history of account-agreement acceptances. `users.legalAcceptance`
 * stays the current-state field that gates publishing; this keeps every earlier
 * version as consent evidence. Kept on account closure under the retention
 * schedule, like other compliance records.
 */
const schema = new Schema({
  userId: { type: String, required: true, index: true },
  version: { type: String, required: true },
  acceptedTerms: { type: Boolean, required: true },
  ageConfirmed: { type: Boolean, required: true },
  acceptedAt: { type: Date, required: true },
  source: { type: String, enum: ['register', 'reaccept', 'backfill'], required: true },
  ip: { type: String },
  userAgent: { type: String },
}, { collection: 'legal_acceptance_events', timestamps: { createdAt: true, updatedAt: false } });

schema.index({ userId: 1, acceptedAt: -1 });

export const LegalAcceptanceEventModel = mongoose.model('LegalAcceptanceEvent', schema);
