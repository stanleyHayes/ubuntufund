import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import { trackActivity } from '../plugins/trackActivity.js';
import mongoose, { Schema, type Document } from 'mongoose';
import type { DonationIntentStatus, DonationProvider } from '@ubuntu-fund/types';

export interface TipDocument extends Document {
  creatorUserId: string;
  amount: number;
  currency: string;
  supporterUserId?: string;
  supporterName?: string;
  supporterEmail?: string;
  publicContentStatus?: 'pending' | 'approved' | 'rejected';
  publicContentFingerprint?: string;
  publicReviewedBy?: string;
  publicReviewedAt?: Date;
  publicReviewNotes?: string;
  message?: string;
  messageHiddenAt?: Date;
  messageAgreement?: LegalAcceptanceRecord;
  isAnonymous: boolean;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef: string;
  requestFingerprint?: string;
  checkoutRevokedAt?: Date;
  checkout?: { checkoutUrl: string; accessCode: string };
  platformFee: number;
  netAmount: number;
  /**
   * G7: set true once the SUCCEEDED tip's balance credit has landed. The credit
   * is a separate write from the PENDING→SUCCEEDED transition, so a crash between
   * them leaves a SUCCEEDED-but-uncredited tip; reconciliation re-drives those.
   */
  settlementApplied: boolean;
  /** Last time the payment sweep re-verified this PENDING tip (fairness order). */
  reconciledAt?: Date;
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
    publicContentStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    publicContentFingerprint: String,
    publicReviewedBy: String,
    publicReviewedAt: Date,
    publicReviewNotes: String,
    message: { type: String },
    messageHiddenAt: Date,
    messageAgreement: { version: String, acceptedTerms: Boolean, ageConfirmed: Boolean, acceptedAt: Date },
    isAnonymous: { type: Boolean, default: false },
    status: { type: String, required: true, default: 'PENDING', index: true },
    provider: { type: String, default: 'paystack' },
    // Unique + sparse: one tip per provider reference so a duplicate webhook
    // can never correlate to two tips.
    providerRef: { type: String, unique: true, sparse: true },
    requestFingerprint: String,
    checkoutRevokedAt: Date,
    checkout: { checkoutUrl: String, accessCode: String },
    platformFee: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    settlementApplied: { type: Boolean, default: false },
    reconciledAt: { type: Date },
  },
  { collection: 'tips', timestamps: true }
);

// The stale-PENDING tip sweep: filter on status/updatedAt, least recently
// reconciled first.
schema.index({ status: 1, reconciledAt: 1, updatedAt: 1 });

schema.plugin(trackActivity);

export const TipModel = mongoose.model<TipDocument>('Tip', schema);
