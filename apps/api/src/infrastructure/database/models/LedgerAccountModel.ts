import mongoose, { Schema, type Document } from 'mongoose';
import type { LedgerAccountKind } from '@ubuntu-fund/types';

export interface LedgerAccountDocument extends Document {
  kind: LedgerAccountKind;
  ownerId: string;
  currency: string;
  createdAt: Date;
}

const LEDGER_ACCOUNT_KINDS: LedgerAccountKind[] = [
  'campaign',
  'platform_fee',
  'processor_fee',
  'tip',
  'beneficiary',
];

const ledgerAccountSchema = new Schema<LedgerAccountDocument>(
  {
    kind: { type: String, enum: LEDGER_ACCOUNT_KINDS, required: true },
    // Campaign id for campaign/beneficiary accounts; 'platform' otherwise.
    ownerId: { type: String, required: true },
    currency: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'ledgeraccounts', timestamps: false }
);

// One account per (kind, owner, currency). The unique index also powers the
// find-or-create upsert used when posting journal lines.
ledgerAccountSchema.index({ kind: 1, ownerId: 1, currency: 1 }, { unique: true });

export const LedgerAccountModel = mongoose.model<LedgerAccountDocument>(
  'LedgerAccount',
  ledgerAccountSchema
);
