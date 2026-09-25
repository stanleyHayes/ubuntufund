import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import { trackActivity } from '../plugins/trackActivity.js';
import mongoose, { Schema, type Document } from 'mongoose';
import { PaymentMethod } from '@ubuntu-fund/types';

export interface DonationDocument extends Document {
  campaignId: string;
  donorId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  publicContentStatus?: 'pending' | 'approved' | 'rejected';
  publicContentFingerprint?: string;
  publicContentRevokedAt?: Date;
  publicReviewedBy?: string;
  publicReviewedAt?: Date;
  publicReviewNotes?: string;
  donorName?: string;
  messageAgreement?: LegalAcceptanceRecord;
  message?: string;
  messageHiddenAt?: Date;
  isAnonymous: boolean;
  /** Set once this donation has been added to its live session's stats. */
  liveStatsAppliedAt?: Date;
  createdAt: Date;
}

const donationSchema = new Schema<DonationDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    donorId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.WALLET, required: true },
    publicContentStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    publicContentFingerprint: String,
    publicContentRevokedAt: Date,
    publicReviewedBy: String,
    publicReviewedAt: Date,
    publicReviewNotes: String,
    donorName: { type: String },
    messageAgreement: { version: String, acceptedTerms: Boolean, ageConfirmed: Boolean, acceptedAt: Date },
    message: { type: String },
    messageHiddenAt: Date,
    isAnonymous: { type: Boolean, default: false },
    // Per-donation claim that makes the live-session stat bump exactly-once
    // under at-least-once outbox delivery (see MongoLiveSessionRepository).
    liveStatsAppliedAt: Date,
  },
  { timestamps: true }
);

donationSchema.plugin(trackActivity);

export const DonationModel = mongoose.model<DonationDocument>(
  'Donation',
  donationSchema
);
