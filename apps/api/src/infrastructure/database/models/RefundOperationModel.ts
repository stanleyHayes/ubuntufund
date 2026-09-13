import mongoose, { Schema } from 'mongoose';
import type { RefundOperation } from '../../../domain/ports/outbound/RefundOperationRepositoryPort.js';

const schema = new Schema<Omit<RefundOperation, 'id'> & { _id: string }>({
  _id: { type: String, required: true },
  intentId: { type: String, required: true },
  campaignId: { type: String, required: true },
  provider: { type: String, required: true },
  transactionReference: { type: String, required: true },
  requestKey: { type: String, required: true },
  adminId: { type: String, required: true },
  amount: { type: Number, required: true },
  amountMinor: { type: Number, required: true },
  cumulativeMinor: { type: Number, required: true },
  maxMinor: { type: Number, required: true },
  currency: { type: String, required: true },
  beneficiaryNet: { type: Number, required: true },
  platformFee: { type: Number, required: true },
  processorFee: { type: Number, required: true },
  fundsHoldVersion: { type: Number, enum: [1] },
  beneficiaryHolds: { type: [new Schema({ beneficiaryId: { type: String, required: true }, amount: { type: Number, required: true } }, { _id: false })], default: undefined },
  state: { type: String, required: true, enum: ['submitting', 'provider_pending', 'provider_unknown', 'provider_failed', 'reversal_pending', 'completed'] },
  active: { type: Boolean, required: true },
  providerReference: String,
  issue: { type: String, enum: ['provider_unconfirmed', 'provider_pending', 'provider_failed', 'local_reversal_failed'] },
}, { timestamps: true });
// Serialize unresolved refunds per contribution, including different client keys.
schema.index({ intentId: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ intentId: 1, requestKey: 1 }, { unique: true });
schema.index({ provider: 1, providerReference: 1 }, { unique: true, partialFilterExpression: { providerReference: { $type: 'string' } } });
schema.index({ active: 1, createdAt: 1 });
export const RefundOperationModel = mongoose.model('RefundOperation', schema);
