import mongoose, { Schema } from 'mongoose';
import type { DonorThankYouStatus } from '@ubuntu-fund/types';

/**
 * A campaign's thank-you message to its donors. One draft per campaign; a
 * submitted message is immutable apart from delivery bookkeeping.
 *
 * `sendSlot` numbers submitted messages per campaign under a unique index, so
 * the admin-configured send limit holds even when two submits race.
 */
export interface DonorThankYouDocument {
  _id: mongoose.Types.ObjectId;
  campaignId: string;
  authorId: string;
  authorRole: 'manager' | 'beneficiary';
  subject: string;
  body: string;
  signature: string;
  status: DonorThankYouStatus;
  sendSlot?: number;
  submitIdempotencyKey?: string;
  submittedBy?: string;
  submittedAt?: Date;
  recipientsResolvedAt?: Date;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  retryableCount: number;
  completedAt?: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DonorThankYouDocument>({
  campaignId: { type: String, required: true, index: true },
  authorId: { type: String, required: true },
  authorRole: { type: String, enum: ['manager', 'beneficiary'], required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  signature: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'queued', 'sending', 'sent', 'partially_sent', 'failed'], default: 'draft', index: true },
  sendSlot: { type: Number },
  submitIdempotencyKey: { type: String },
  submittedBy: String,
  submittedAt: Date,
  recipientsResolvedAt: Date,
  recipientCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  retryableCount: { type: Number, default: 0 },
  completedAt: Date,
  leaseToken: String,
  leaseUntil: Date,
}, { timestamps: true, collection: 'donor_thank_yous' });

schema.index({ campaignId: 1 }, { unique: true, partialFilterExpression: { status: 'draft' }, name: 'one_draft_per_campaign' });
schema.index({ campaignId: 1, sendSlot: 1 }, { unique: true, partialFilterExpression: { sendSlot: { $type: 'number' } }, name: 'one_message_per_send_slot' });
schema.index({ campaignId: 1, submitIdempotencyKey: 1 }, { unique: true, partialFilterExpression: { submitIdempotencyKey: { $type: 'string' } }, name: 'thank_you_submit_idempotency' });

export const DonorThankYouModel = mongoose.model<DonorThankYouDocument>('DonorThankYou', schema);
