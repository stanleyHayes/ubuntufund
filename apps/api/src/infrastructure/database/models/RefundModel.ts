import mongoose, { Schema, type Document } from 'mongoose';
import type { RefundStatus } from '../../../domain/ports/outbound/RefundRepositoryPort.js';

export interface RefundDocument extends Document {
  donationId: string;
  campaignId: string;
  requesterId: string;
  reason: string;
  description?: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: RefundStatus;
  createdAt: Date;
  updatedAt: Date;
}

const REFUND_STATUSES: RefundStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
];

const refundSchema = new Schema<RefundDocument>(
  {
    donationId: { type: String, required: true, index: true, unique: true },
    campaignId: { type: String, required: true, index: true },
    requesterId: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: REFUND_STATUSES,
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

export const RefundModel = mongoose.model<RefundDocument>(
  'Refund',
  refundSchema
);
