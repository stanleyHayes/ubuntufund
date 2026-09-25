import mongoose, { Schema, type Document } from 'mongoose';
import type { DisputeStatus } from '../../../domain/ports/outbound/DisputeRepositoryPort.js';

export interface DisputeDocument extends Document {
  campaignId: string;
  reporterId: string;
  assigneeId?: string;
  reason: string;
  description?: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  source?: 'staff' | 'paystack';
  providerDisputeId?: string;
  transactionReference?: string;
  donationIntentId?: string;
  amount?: number;
  currency?: string;
  dueAt?: Date;
  providerStatus?: string;
  providerResolution?: string;
  reversalOperationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DISPUTE_STATUSES: DisputeStatus[] = [
  'open',
  'under_review',
  'resolved',
  'dismissed',
];

const disputeSchema = new Schema<DisputeDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    reporterId: { type: String, required: true, index: true },
    assigneeId: { type: String },
    reason: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: 'open',
      index: true,
    },
    resolution: { type: String },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    // Provider-originated cases (chargebacks, refunds issued outside Ujimora).
    source: { type: String, enum: ['staff', 'paystack'] },
    providerDisputeId: { type: String },
    transactionReference: { type: String },
    donationIntentId: { type: String },
    amount: { type: Number },
    currency: { type: String },
    dueAt: { type: Date },
    providerStatus: { type: String },
    providerResolution: { type: String },
    reversalOperationId: { type: String },
  },
  { timestamps: true }
);

// One row per provider case, however often the provider re-sends it.
disputeSchema.index({ providerDisputeId: 1 }, { unique: true, partialFilterExpression: { providerDisputeId: { $type: 'string' } } });

export const DisputeModel = mongoose.model<DisputeDocument>(
  'Dispute',
  disputeSchema
);
