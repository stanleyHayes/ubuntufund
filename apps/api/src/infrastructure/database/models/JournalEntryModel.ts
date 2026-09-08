import mongoose, { Schema, type Document } from 'mongoose';

export interface JournalEntryDocument extends Document {
  donationId?: string;
  donationIntentId?: string;
  externalRef?: string;
  memo: string;
  currency: string;
  createdAt: Date;
}

const journalEntrySchema = new Schema<JournalEntryDocument>(
  {
    donationId: { type: String, index: true },
    // Unique + sparse: guarantees a donation intent settles into at most one
    // ledger entry, so a retried settlement can never double-post.
    donationIntentId: { type: String, unique: true, sparse: true },
    // Idempotency key for non-donation entries (payout disbursement/reversal):
    // unique + sparse so a re-run posts at most one entry per settlement.
    externalRef: { type: String, unique: true, sparse: true },
    memo: { type: String, required: true },
    currency: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { collection: 'journalentries', timestamps: false }
);

export const JournalEntryModel = mongoose.model<JournalEntryDocument>(
  'JournalEntry',
  journalEntrySchema
);
