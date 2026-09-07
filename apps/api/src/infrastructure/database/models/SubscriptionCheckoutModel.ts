import mongoose, { Schema, type Document } from 'mongoose';
import {
  SubscriptionCheckoutStatus,
  BillingCycle,
} from '@ubuntu-fund/types';

export interface SubscriptionCheckoutDocument extends Document {
  userId: string;
  tier: string;
  billingCycle: BillingCycle;
  status: SubscriptionCheckoutStatus;
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  couponId?: string;
  couponCode?: string;
  providerRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionCheckoutSchema = new Schema<SubscriptionCheckoutDocument>(
  {
    userId: { type: String, required: true, index: true },
    // Free-form so a checkout can target an admin-added tier.
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
      enum: Object.values(SubscriptionCheckoutStatus),
      required: true,
      default: SubscriptionCheckoutStatus.PENDING,
      index: true,
    },
    baseAmount: { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'GHS' },
    couponId: { type: String },
    couponCode: { type: String },
    // Unique + sparse: the signed webhook correlates settlement back to exactly
    // one checkout by this reference.
    providerRef: { type: String, unique: true, sparse: true },
  },
  {
    collection: 'subscriptioncheckouts',
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

export const SubscriptionCheckoutModel =
  mongoose.model<SubscriptionCheckoutDocument>(
    'SubscriptionCheckout',
    subscriptionCheckoutSchema
  );
