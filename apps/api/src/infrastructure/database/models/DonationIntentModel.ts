import mongoose, { Schema, type Document } from 'mongoose';
import type {
  DonationIntentStatus,
  DonationProvider,
} from '@ubuntu-fund/types';

export interface DonationIntentDocument extends Document {
  campaignId: string;
  liveSessionId?: string;
  amount: number;
  currency: string;
  donorUserId: string | null;
  donorEmail?: string;
  donorName?: string;
  message?: string;
  isAnonymous: boolean;
  tip: number;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef?: string;
  idempotencyKey: string;
  attribution?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DONATION_INTENT_STATUSES: DonationIntentStatus[] = [
  'CREATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
];

const DONATION_PROVIDERS: DonationProvider[] = ['wallet', 'paystack'];

const donationIntentSchema = new Schema<DonationIntentDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    liveSessionId: { type: String, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    // Null for guest checkouts.
    donorUserId: { type: String, default: null, index: true },
    donorEmail: { type: String },
    donorName: { type: String },
    message: { type: String },
    isAnonymous: { type: Boolean, default: false },
    tip: { type: Number, default: 0 },
    status: {
      type: String,
      enum: DONATION_INTENT_STATUSES,
      required: true,
      default: 'CREATED',
      index: true,
    },
    provider: { type: String, enum: DONATION_PROVIDERS, required: true },
    providerRef: { type: String, index: true },
    // Unique: repeated submits with the same key resolve to one intent.
    idempotencyKey: { type: String, required: true, unique: true },
    attribution: { type: String },
  },
  { collection: 'donationintents', timestamps: true }
);

export const DonationIntentModel = mongoose.model<DonationIntentDocument>(
  'DonationIntent',
  donationIntentSchema
);
