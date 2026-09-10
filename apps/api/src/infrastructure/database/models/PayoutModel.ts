import mongoose, { Schema, type Document } from 'mongoose'
import type {
  PayoutLeg,
  PayoutLegStatus,
  PayoutProvider,
  PayoutStatus,
  PayoutType,
} from '@ubuntu-fund/types'

export interface PayoutDocument extends Document {
  campaignId: string
  recipientId: string
  amount: number
  type: PayoutType
  fee: number
  netAmount: number
  currency: string
  status: PayoutStatus
  provider: PayoutProvider
  providerRef?: string
  transferCode?: string
  requestedBy: string
  approvedBy?: string
  walletReviewNote?: string
  walletReviews?: { adminId: string; note: string; reviewedAt: Date }[]
  firstApprovedBy?: string
  firstApprovedAt?: Date
  legs?: PayoutLeg[]
  /** True once the terminal balance/ledger effect has been applied (G5). */
  settlementApplied?: boolean
  /**
   * The status a REVERSED payout came from (G7): 'PAID' (a settled transfer
   * bounced — owes reverseFromPaidOut) or 'PROCESSING' (reversed before we saw
   * success — owes returnToAvailable). Lets the reconciler repair a reversal
   * whose effect a crash left unapplied.
   */
  reversedFrom?: 'PAID' | 'PROCESSING'
  createdAt: Date
  updatedAt: Date
}

const PAYOUT_STATUSES: PayoutStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAID',
  'FAILED',
  'REVERSED',
  'NEEDS_REVIEW',
]

const PAYOUT_LEG_STATUSES: PayoutLegStatus[] = [
  'queued',
  'submitted',
  'success',
  'failed',
  'reversed',
]

const PAYOUT_PROVIDERS: PayoutProvider[] = ['paystack', 'ujimora_wallet']

const payoutLegSchema = new Schema<PayoutLeg>(
  {
    index: { type: Number, required: true },
    amount: { type: Number, required: true },
    reference: { type: String, required: true },
    transferCode: { type: String },
    status: { type: String, enum: PAYOUT_LEG_STATUSES, default: 'queued' },
  },
  { _id: false },
)

const payoutSchema = new Schema<PayoutDocument>(
  {
    campaignId: { type: String, required: true, index: true },
    recipientId: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, default: 'standard' },
    fee: { type: Number, default: 0 },
    netAmount: { type: Number },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: PAYOUT_STATUSES,
      required: true,
      default: 'PENDING',
      index: true,
    },
    provider: { type: String, enum: PAYOUT_PROVIDERS, required: true },
    // Unique + sparse: at most one payout per transfer reference, so a duplicate
    // transfer webhook can never correlate to two payouts.
    providerRef: { type: String, unique: true, sparse: true },
    transferCode: { type: String },
    requestedBy: { type: String, required: true, index: true },
    approvedBy: { type: String },
    walletReviewNote: String,
    walletReviews: {
      type: [{ adminId: String, note: String, reviewedAt: Date }],
      default: undefined,
    },
    firstApprovedBy: { type: String },
    firstApprovedAt: { type: Date },
    legs: { type: [payoutLegSchema], default: undefined },
    settlementApplied: { type: Boolean, default: false, index: true },
    reversedFrom: { type: String, enum: ['PAID', 'PROCESSING'] },
  },
  { collection: 'payouts', timestamps: true },
)

// A leg's transfer reference is globally unique so a transfer webhook correlates
// to exactly one leg of one payout (sparse: payouts without legs are exempt).
payoutSchema.index({ 'legs.reference': 1 }, { unique: true, sparse: true })

export const PayoutModel = mongoose.model<PayoutDocument>('Payout', payoutSchema)
