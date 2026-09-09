import mongoose, { Schema, type Document } from 'mongoose';
import type { JournalDirection, LedgerAccountKind } from '@ubuntu-fund/types';

export interface JournalLineDocument extends Document {
  journalEntryId: string;
  accountId: string;
  accountKind: LedgerAccountKind;
  accountOwnerId: string;
  direction: JournalDirection;
  amount: number;
  currency: string;
  createdAt: Date;
}

const LEDGER_ACCOUNT_KINDS: LedgerAccountKind[] = [
  'wallet',
  'payment_clearing',
  'campaign',
  'platform_fee',
  'processor_fee',
  'tip',
  'beneficiary',
  'payout',
];

const journalLineSchema = new Schema<JournalLineDocument>(
  {
    journalEntryId: { type: String, required: true, index: true },
    accountId: { type: String, required: true, index: true },
    // Denormalized so projections can sum by account kind without a join.
    accountKind: { type: String, enum: LEDGER_ACCOUNT_KINDS, required: true },
    accountOwnerId: { type: String, required: true, index: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'journallines', timestamps: false }
);

// Powers the raised-total projection: sum campaign-kind debit lines per owner.
journalLineSchema.index({ accountKind: 1, accountOwnerId: 1, direction: 1 });

export const JournalLineModel = mongoose.model<JournalLineDocument>(
  'JournalLine',
  journalLineSchema
);
