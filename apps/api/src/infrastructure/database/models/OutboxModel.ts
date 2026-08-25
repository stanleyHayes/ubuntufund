import mongoose, { Schema, type Document } from 'mongoose';
import type { OutboxEventType, OutboxStatus } from '@ubuntu-fund/types';

export interface OutboxDocument extends Document {
  type: OutboxEventType;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  createdAt: Date;
  dispatchedAt?: Date;
}

const OUTBOX_STATUSES: OutboxStatus[] = ['pending', 'dispatched'];

const outboxSchema = new Schema<OutboxDocument>(
  {
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: OUTBOX_STATUSES,
      required: true,
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now, index: true },
    dispatchedAt: { type: Date },
  },
  { collection: 'outbox', timestamps: false }
);

export const OutboxModel = mongoose.model<OutboxDocument>('Outbox', outboxSchema);
