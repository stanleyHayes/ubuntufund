import { trackActivity } from '../plugins/trackActivity.js';
import mongoose, { Schema, type Document } from 'mongoose';
import type { PayoutClosure, PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface BeneficiaryPayoutReview {
  stage: 'first' | 'final';
  by: string;
  at: Date;
  note: string;
}

export interface BeneficiaryPayoutDocument extends Document {
  campaignId: string;
  beneficiaryId: string;
  recipientId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
  firstApprovedBy?: string;
  firstApprovedAt?: Date;
  firstApprovalFingerprint?: string;
  /** The destination the request was made against; approval pays only that one. */
  destinationFingerprint?: string;
  /** What the request moved pending → available; a close returns exactly this. */
  clearedAmount?: number;
  /** Set when a PENDING request was rejected or cancelled before any transfer. */
  closure?: PayoutClosure;
  /** Each approver's destination review note (maker first, then the approval that disbursed). */
  reviews?: BeneficiaryPayoutReview[];
  settlementApplied?: boolean;
  settlementWriteVersion?: number;
  /** For a REVERSED payout, the status it reversed from (G7 repair). */
  reversedFrom?: 'PAID' | 'PROCESSING';
  createdAt: Date;
  updatedAt: Date;
}

// Beneficiary payouts are single-transfer; NEEDS_REVIEW is unused here but part
// of the shared status enum.
const PAYOUT_STATUSES: PayoutStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REVERSED',
  'NEEDS_REVIEW',
];

const schema = new Schema<BeneficiaryPayoutDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    beneficiaryId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    provider: { type: String, enum: ['paystack'], required: true },
    providerRef: { type: String, unique: true, sparse: true },
    transferCode: { type: String },
    requestedBy: { type: String, required: true },
    approvedBy: { type: String },
    firstApprovedBy: { type: String },
    firstApprovedAt: { type: Date },
    firstApprovalFingerprint: { type: String },
    destinationFingerprint: { type: String },
    clearedAmount: { type: Number },
    closure: {
      type: new Schema<PayoutClosure>(
        {
          kind: { type: String, enum: ['rejected', 'cancelled'], required: true },
          reason: { type: String, required: true },
          closedBy: { type: String, required: true },
          closedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
      default: undefined,
    },
    reviews: {
      type: [new Schema<BeneficiaryPayoutReview>({
        stage: { type: String, enum: ['first', 'final'], required: true },
        by: { type: String, required: true },
        at: { type: Date, required: true },
        note: { type: String, required: true },
      }, { _id: false })],
      default: undefined,
    },
    settlementWriteVersion: { type: Number },
    settlementApplied: { type: Boolean, default: false, index: true },
    reversedFrom: { type: String, enum: ['PAID', 'PROCESSING'] },
  },
  { collection: 'beneficiary_payouts', timestamps: true }
);

schema.plugin(trackActivity);

export const BeneficiaryPayoutModel =
  mongoose.model<BeneficiaryPayoutDocument>('BeneficiaryPayout', schema);
