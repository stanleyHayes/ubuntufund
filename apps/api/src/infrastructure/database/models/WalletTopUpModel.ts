import mongoose, { Schema } from 'mongoose';

const schema = new Schema({
  userId: { type: String, required: true, index: true },
  walletId: { type: String, required: true },
  amountMinor: { type: Number, required: true },
  currency: { type: String, default: 'GHS' },
  reference: { type: String, required: true, unique: true },
  idempotencyKey: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  authorizationUrl: String,
  feeMinor: Number,
  settledAt: Date,
}, { timestamps: true });
schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
export const WalletTopUpModel = mongoose.model('WalletTopUp', schema);
