import mongoose, { Schema } from 'mongoose';

export type DonorThankYouDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped';

/**
 * One recipient of one thank-you. The id is sha256(thankYouId:recipientKey:channel),
 * so re-resolving recipients after a crash upserts the same rows and a donor who
 * gave several times still gets one message.
 *
 * No address is stored in plain form except inside `emailRequest` while a send
 * is in flight (kept so an ambiguous retry repeats the exact request under the
 * same provider idempotency key); it is removed once the outcome is known.
 */
export interface DonorThankYouDeliveryDocument {
  _id: string;
  thankYouId: string;
  campaignId: string;
  /** `user:<id>` or `email:<sha256 of the lowercased address>`. */
  recipientKey: string;
  recipientUserId?: string;
  emailHash?: string;
  /** The donations that made this donor eligible; re-checked just before sending. */
  intentIds: string[];
  channel: 'email';
  status: DonorThankYouDeliveryStatus;
  skipReason?: 'donation_refunded' | 'unsubscribed' | 'no_contact';
  attempts: number;
  /** Manual retries bump this, so a definite failure can be retried under a fresh provider key. */
  retryGeneration: number;
  nextAttemptAt: Date;
  firstAttemptAt?: Date;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  retryable?: boolean;
  providerMessageId?: string;
  sentAt?: Date;
  failedAt?: Date;
  leaseToken?: string;
  leaseUntil?: Date;
  emailRequest?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DonorThankYouDeliveryDocument>({
  _id: { type: String },
  thankYouId: { type: String, required: true, index: true },
  campaignId: { type: String, required: true },
  recipientKey: { type: String, required: true },
  recipientUserId: String,
  emailHash: String,
  intentIds: { type: [String], default: [] },
  channel: { type: String, enum: ['email'], default: 'email' },
  status: { type: String, enum: ['pending', 'sent', 'failed', 'skipped'], default: 'pending' },
  skipReason: { type: String, enum: ['donation_refunded', 'unsubscribed', 'no_contact'] },
  attempts: { type: Number, default: 0 },
  retryGeneration: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  firstAttemptAt: Date,
  lastErrorCode: String,
  lastErrorMessage: String,
  retryable: Boolean,
  providerMessageId: String,
  sentAt: Date,
  failedAt: Date,
  leaseToken: String,
  leaseUntil: Date,
  emailRequest: { type: Schema.Types.Mixed, select: false },
}, { timestamps: true, collection: 'donor_thank_you_deliveries' });

schema.index({ thankYouId: 1, recipientKey: 1, channel: 1 }, { unique: true, name: 'one_delivery_per_recipient' });
schema.index({ status: 1, nextAttemptAt: 1 });

export const DonorThankYouDeliveryModel = mongoose.model<DonorThankYouDeliveryDocument>('DonorThankYouDelivery', schema);
