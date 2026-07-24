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
  },
  { timestamps: true }
);

export const DisputeModel = mongoose.model<DisputeDocument>(
  'Dispute',
  disputeSchema
);
