import mongoose, { Schema } from 'mongoose';
const schema = new Schema({
  provider: { type: String, required: true },
  reference: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  network: { type: String, required: true },
  asset: { type: String, required: true },
  decimals: { type: Number, required: true },
  expectedMinor: { type: String, required: true },
  quoteId: { type: String, required: true },
  transactionReference: String,
}, { timestamps: true });
// An address must never be shared by independent contributions.
schema.index({ provider: 1, address: 1, network: 1 }, { unique: true });
export const CryptoProviderDepositModel = mongoose.model('CryptoProviderDeposit', schema);
