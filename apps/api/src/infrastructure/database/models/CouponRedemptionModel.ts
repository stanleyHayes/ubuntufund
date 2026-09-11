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
  seat?: number;
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
    // 0-based per-user seat ordinal; absent when the coupon has no per-user cap.
    seat: { type: Number },
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

/**
 * The per-user cap, enforced by the database rather than by a prior read.
 *
 * `CouponService` counts a user's existing redemptions and rejects when the
 * count has reached the limit, but that is check-then-act: two checkouts
 * submitted at the same moment both read the same count, both pass, and both
 * insert. This index makes the seat ordinal itself unique per (coupon, user),
 * so the second insert collides and is retried at the next ordinal — which is
 * then over the limit and refused.
 *
 * Partial, on `seat` existing: a coupon with no per-user cap assigns no seat,
 * and an unlimited coupon must not be limited to one row per user. Releasing a
 * slot unsets `seat`, returning it to the pool.
 */
couponRedemptionSchema.index(
  { couponId: 1, userId: 1, seat: 1 },
  { unique: true, partialFilterExpression: { seat: { $exists: true } } }
);

export const CouponRedemptionModel = mongoose.model<CouponRedemptionDocument>(
  'CouponRedemption',
  couponRedemptionSchema
);
