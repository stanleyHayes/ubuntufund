import mongoose, { Schema, type Document } from 'mongoose';
import type {
  ContributionMethod,
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
  // Multi-currency & settlement (spec §8) — optional/additive.
  originalAmountMinor?: number;
  originalCurrency?: string;
  settlementAmountMinor?: number;
  settlementCurrency?: string;
  fxRate?: number;
  fxSource?: string;
  country?: string;
  paymentMethod?: ContributionMethod;
  providerFeeMinor?: number;
  platformFeeMinor?: number;
  netCampaignAmountMinor?: number;
  // Refund tracking (spec §14).
  refundedAmountMinor?: number;
  refundKeys?: string[];
}

const DONATION_INTENT_STATUSES: DonationIntentStatus[] = [
  'CREATED',
  'PENDING',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'REFUND_PENDING',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'DISPUTED',
  'CHARGEBACK',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
];

const DONATION_PROVIDERS: DonationProvider[] = ['wallet', 'paystack', 'flutterwave'];

const CONTRIBUTION_METHODS: ContributionMethod[] = [
  'mobile_money',
  'card',
  'bank',
  'ussd',
  'wallet',
];

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
    // Multi-currency & settlement (spec §8) — all optional; legacy GHS records
    // omit them and derive from amount/currency.
    originalAmountMinor: { type: Number },
    originalCurrency: { type: String },
    settlementAmountMinor: { type: Number },
    settlementCurrency: { type: String },
    fxRate: { type: Number },
    fxSource: { type: String },
    country: { type: String },
    paymentMethod: { type: String, enum: CONTRIBUTION_METHODS },
    providerFeeMinor: { type: Number },
    platformFeeMinor: { type: Number },
    netCampaignAmountMinor: { type: Number },
    // Refund tracking (spec §14): cumulative refunded minor units + the
    // idempotency keys already applied, so a replayed refund can't double-refund.
    refundedAmountMinor: { type: Number },
    refundKeys: { type: [String], default: undefined },
  },
  { collection: 'donationintents', timestamps: true }
);

export const DonationIntentModel = mongoose.model<DonationIntentDocument>(
  'DonationIntent',
  donationIntentSchema
);
