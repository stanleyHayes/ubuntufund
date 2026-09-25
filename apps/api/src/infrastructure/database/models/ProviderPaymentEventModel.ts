import mongoose, { Schema } from 'mongoose';

/**
 * Provider-originated disputes/chargebacks and refunds (see
 * ProviderPaymentEventRepositoryPort). The unique eventKey makes a replayed
 * webhook a no-op. No customer details are stored.
 */
const schema = new Schema({
  provider: { type: String, required: true },
  event: { type: String, required: true },
  kind: { type: String, required: true, enum: ['dispute', 'refund'] },
  eventKey: { type: String, required: true, unique: true },
  reference: { type: String, index: true },
  subject: { type: String, required: true, enum: ['donation', 'tip', 'subscription', 'wallet_topup', 'unknown'] },
  subjectId: String,
  campaignId: { type: String, index: true },
  providerCaseId: String,
  amountMinor: Number,
  currency: String,
  providerStatus: String,
  providerResolution: String,
  reviewStatus: { type: String, required: true, enum: ['open', 'acknowledged'], default: 'open' },
  acknowledgedBy: String,
  acknowledgedAt: Date,
}, { collection: 'providerpaymentevents', timestamps: true });
schema.index({ reviewStatus: 1, createdAt: -1 });

export const ProviderPaymentEventModel = mongoose.model('ProviderPaymentEvent', schema);
