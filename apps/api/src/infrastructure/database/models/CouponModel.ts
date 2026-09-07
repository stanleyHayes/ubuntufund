import mongoose, { Schema, type Document } from 'mongoose';
import { CouponDiscountType, BillingCycle } from '@ubuntu-fund/types';

export interface CouponDocument extends Document {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  amount: number;
  currency: string;
  maxRedemptions?: number;
  redemptions: number;
  perUserLimit?: number;
  minSubtotal?: number;
  appliesToTiers: string[];
  appliesToBillingCycles: BillingCycle[];
  validFrom?: Date;
  validUntil?: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<CouponDocument>(
  {
    // Stored and matched UPPERCASE; unique across all coupons.
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    description: { type: String },
    discountType: {
      type: String,
      enum: Object.values(CouponDiscountType),
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'GHS' },
    // Falsy (absent/0) = unlimited global cap.
    maxRedemptions: { type: Number },
    // Running count of CONSUMED redemptions; only ever bumped by the atomic
    // incrementRedemptionIfUnderLimit gate.
    redemptions: { type: Number, required: true, default: 0 },
    perUserLimit: { type: Number },
    minSubtotal: { type: Number },
    // Empty = applies to all paid tiers / all cycles.
    // Free-form tier ids (admin-added tiers included); empty = all paid tiers.
    appliesToTiers: {
      type: [String],
      default: [],
    },
    appliesToBillingCycles: {
      type: [String],
      enum: Object.values(BillingCycle),
      default: [],
    },
    validFrom: { type: Date },
    validUntil: { type: Date },
    active: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'coupons',
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

export const CouponModel = mongoose.model<CouponDocument>(
  'Coupon',
  couponSchema
);
