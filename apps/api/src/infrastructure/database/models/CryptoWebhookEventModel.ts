import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A processed crypto webhook event (Crypto Donations plan §8). The unique
 * (provider, eventId) index is the idempotency backstop: a duplicate or replayed
 * webhook fails the insert and is skipped, so a campaign can never be credited
 * twice from the same provider event.
 */
export interface CryptoWebhookEventDocument extends Document {
  provider: string;
  eventId: string;
  type: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CryptoWebhookEventDocument>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: () => new Date() },
  },
  { collection: 'cryptowebhookevents', timestamps: true }
);

// Idempotency: one row per (provider, eventId); a replay hits this and is skipped.
schema.index({ provider: 1, eventId: 1 }, { unique: true });

export const CryptoWebhookEventModel = mongoose.model<CryptoWebhookEventDocument>(
  'CryptoWebhookEvent',
  schema
);
