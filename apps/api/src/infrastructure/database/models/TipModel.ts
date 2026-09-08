import mongoose, { Schema, type Document } from 'mongoose';
import type { DonationIntentStatus, DonationProvider } from '@ubuntu-fund/types';

export interface TipDocument extends Document {
  creatorUserId: string;
  amount: number;
  currency: string;
  supporterUserId?: string;
  supporterName?: string;
  supporterEmail?: string;
  message?: string;
  isAnonymous: boolean;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef: string;
  platformFee: number;
  netAmount: number;
  /**
   * G7: set true once the SUCCEEDED tip's balance credit has landed. The credit
   * is a separate write from the PENDING→SUCCEEDED transition, so a crash between
   * them leaves a SUCCEEDED-but-uncredited tip; reconciliation re-drives those.
   */
  settlementApplied: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<TipDocument>(
  {
    creatorUserId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'GHS' },
    supporterUserId: { type: String },
    supporterName: { type: String },
    supporterEmail: { type: String },
    message: { type: String },
    isAnonymous: { type: Boolean, default: false },
    status: { type: String, required: true, default: 'PENDING', index: true },
    provider: { type: String, default: 'paystack' },
    // Unique + sparse: one tip per provider reference so a duplicate webhook
    // can never correlate to two tips.
    providerRef: { type: String, unique: true, sparse: true },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    settlementApplied: { type: Boolean, default: false },
  },
  { collection: 'tips', timestamps: true }
);

export const TipModel = mongoose.model<TipDocument>('Tip', schema);
