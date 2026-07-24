import mongoose, { Schema, type Document } from 'mongoose';
import { SubscriptionTier, SubscriptionStatus, BillingCycle } from '@ubuntu-fund/types';

export interface SubscriptionDocument extends Document {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: { type: String, required: true, index: true, unique: true },
    tier: {
      type: String,
      enum: Object.values(SubscriptionTier),
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

export const SubscriptionModel = mongoose.model<SubscriptionDocument>(
  'Subscription',
  subscriptionSchema
);
