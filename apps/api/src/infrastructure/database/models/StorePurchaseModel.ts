import mongoose, { Schema } from 'mongoose';

/** Private payment evidence. APIs return subscription summaries, never these rows. */
const schema = new Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  store: { type: String, enum: ['apple', 'google'], required: true },
  referenceCiphertext: { type: String, required: true, select: false },
  productId: { type: String, required: true },
  basePlanId: String,
  active: { type: Boolean, required: true },
  autoRenew: { type: Boolean, required: true },
  periodEnd: { type: Date, required: true },
  acknowledgementPending: { type: Boolean, default: false },
  nextCheckAt: { type: Date, required: true, index: true },
  lastCheckedAt: { type: Date, required: true },
  verificationRevision: { type: Number, required: true },
  reviewRequired: { type: Boolean, default: false },
  lastError: String,
  replacedBy: String,
  /** App Review / TestFlight purchases are sandbox; never count them as revenue. */
  environment: { type: String, enum: ['production', 'sandbox'] },
}, { timestamps: true });

export const StorePurchaseModel = mongoose.model('StorePurchase', schema);
