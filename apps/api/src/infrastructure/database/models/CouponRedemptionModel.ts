import mongoose, { Schema, type Document } from 'mongoose';
import { CouponRedemptionStatus, BillingCycle } from '@ubuntu-fund/types';

export interface CouponRedemptionDocument extends Document {
  couponId: string;
  code: string;
  userId: string;
  subscriptionId?: string;
  checkoutId?: string;
  tier: string;
  billingCycle: BillingCycle;
  status: CouponRedemptionStatus;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  providerRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const couponRedemptionSchema = new Schema<CouponRedemptionDocument>(
  {
    couponId: { type: String, required: true, index: true },
    code: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    subscriptionId: { type: String },
    checkoutId: { type: String },
    tier: {
      type: String,
      required: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CouponRedemptionStatus),
      required: true,
      default: CouponRedemptionStatus.PENDING,
      index: true,
    },
    baseAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'GHS' },
    // Unique + sparse: at most one redemption per Paystack reference, so a
    // duplicate settlement webhook can never correlate to two slots.
    providerRef: { type: String, unique: true, sparse: true },
  },
  {
    collection: 'couponredemptions',
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id?.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Per-user seat lookups (countByCouponAndUser) hit this compound index.
couponRedemptionSchema.index({ couponId: 1, userId: 1 });

export const CouponRedemptionModel = mongoose.model<CouponRedemptionDocument>(
  'CouponRedemption',
  couponRedemptionSchema
);
