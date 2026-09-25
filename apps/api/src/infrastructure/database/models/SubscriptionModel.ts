import { trackActivity } from '../plugins/trackActivity.js';
import mongoose, { Schema, type Document } from 'mongoose';
import { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@ubuntu-fund/types';

export interface SubscriptionDocument extends Document {
  consumptionWriteVersion: number;
  userId: string;
  tier: string;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  billingProvider?: 'web' | 'apple' | 'google';
  billingEnvironment?: 'production' | 'sandbox';
  storePurchaseKey?: string;
  paymentReferences?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    consumptionWriteVersion: { type: Number, default: 0 },
    userId: { type: String, required: true, index: true, unique: true },
    // Free-form so a user can hold an admin-added tier; defaults to the free tier.
    tier: {
      type: String,
      required: true,
      default: SubscriptionTier.FREE,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: true,
      default: SubscriptionStatus.ACTIVE,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      required: true,
      default: BillingCycle.MONTHLY,
    },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    trialEnd: { type: Date },
    billingProvider: { type: String, enum: ['web', 'apple', 'google'] },
    // Store purchases only: sandbox (App Review / TestFlight) entitlements work
    // but are not revenue.
    billingEnvironment: { type: String, enum: ['production', 'sandbox'] },
    storePurchaseKey: { type: String },
    // Web charges that paid for the current period (refunds take their time back).
    paymentReferences: { type: [String], default: undefined },
  },
  {
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

subscriptionSchema.plugin(trackActivity);

export const SubscriptionModel = mongoose.model<SubscriptionDocument>(
  'Subscription',
  subscriptionSchema
);
