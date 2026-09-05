import mongoose, { Schema, type Document } from 'mongoose';
import type {
  AffiliateCommissionSource,
  AffiliateCommissionStatus,
} from '@ubuntu-fund/types';

export interface AffiliateCommissionDocument extends Document {
  affiliateId: string;
  refereeId: string;
  source: AffiliateCommissionSource;
  sourceRef: string;
  amount: number;
  currency: string;
  baseAmount: number;
  commissionRate: number;
  status: AffiliateCommissionStatus;
  maturesAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const COMMISSION_STATUSES: AffiliateCommissionStatus[] = [
  'held',
  'available',
  'paid',
  'reversed',
  'cancelled',
];

const COMMISSION_SOURCES: AffiliateCommissionSource[] = ['subscription'];

const affiliateCommissionSchema = new Schema<AffiliateCommissionDocument>(
  {
    affiliateId: { type: String, required: true },
    refereeId: { type: String, required: true },
    source: { type: String, enum: COMMISSION_SOURCES, required: true },
    // Unique + sparse: the subscription charge providerRef this was earned on —
    // the idempotency seam, so a replayed settlement can never accrue twice.
    sourceRef: { type: String, required: true, unique: true, sparse: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    baseAmount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    status: {
      type: String,
      enum: COMMISSION_STATUSES,
      required: true,
      default: 'held',
      index: true,
    },
    maturesAt: { type: Date, required: true },
  },
  { collection: 'affiliatecommissions', timestamps: true }
);

// Owner-scoped lookups (dashboard/history) resolve on the affiliateId prefix.
affiliateCommissionSchema.index({ affiliateId: 1, refereeId: 1 });

export const AffiliateCommissionModel =
  mongoose.model<AffiliateCommissionDocument>(
    'AffiliateCommission',
    affiliateCommissionSchema
  );
