import mongoose, { Schema, type Document } from 'mongoose';
import {
  CouponDiscountType,
  BillingCycle,
  CouponSurface,
  CouponCommissionBase,
} from '@ubuntu-fund/types';

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
  maxDiscountAmount?: number;
  appliesToSurfaces: CouponSurface[];
  commissionBase: CouponCommissionBase;
  newUsersOnly: boolean;
  allowedEmails: string[];
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
    // Ceiling on what a PERCENT coupon may take off. Falsy = no ceiling.
    maxDiscountAmount: { type: Number },
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
    // Empty = subscription only, which is what every pre-existing coupon is.
    appliesToSurfaces: {
      type: [String],
      enum: Object.values(CouponSurface),
      default: [],
    },
    commissionBase: {
      type: String,
      enum: Object.values(CouponCommissionBase),
      required: true,
      default: CouponCommissionBase.POST_COUPON,
    },
    // "Has never completed a paid checkout", not "signed up recently".
    newUsersOnly: { type: Boolean, required: true, default: false },
    // Named recipients, lowercased on write. Empty = open to anyone.
    allowedEmails: { type: [String], default: [], lowercase: true },
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
