import mongoose, { Schema, type Document } from 'mongoose';
import { SubscriptionTier } from '@ubuntu-fund/types';

/**
 * A persisted, admin-editable subscription plan. Keyed by its `tier` (unique),
 * which is the plan's immutable identity — every other field can be edited from
 * the admin console. The document mirrors the `SubscriptionPlan` interface;
 * `SUBSCRIPTION_PLANS` remains the seed + safe fallback when a row is absent.
 */
export interface SubscriptionPlanDocument extends Document {
  tier: SubscriptionTier;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  platformFeePercent: number;
  maxActiveCampaigns: number;
  maxCampaignGoal: number;
  featuredListing: boolean;
  prioritySupport: boolean;
  advancedAnalytics: boolean;
  customBranding: boolean;
  maxMediaPerCampaign: number;
  escrowSupport: boolean;
  liveStreaming: boolean;
  maxTeamMembers: number;
  campaignCollaboration: boolean;
  maxCollaboratorsPerCampaign: number;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionPlanSchema = new Schema<SubscriptionPlanDocument>(
  {
    tier: {
      type: String,
      enum: Object.values(SubscriptionTier),
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    priceMonthly: { type: Number, required: true, min: 0 },
    priceYearly: { type: Number, required: true, min: 0 },
    platformFeePercent: { type: Number, required: true, min: 0, max: 100 },
    // -1 means unlimited for the numeric caps below.
    maxActiveCampaigns: { type: Number, required: true, min: -1 },
    maxCampaignGoal: { type: Number, required: true, min: -1 },
    featuredListing: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    maxMediaPerCampaign: { type: Number, required: true, min: -1 },
    escrowSupport: { type: Boolean, default: false },
    liveStreaming: { type: Boolean, default: false },
    maxTeamMembers: { type: Number, required: true, min: -1 },
    campaignCollaboration: { type: Boolean, default: false },
    maxCollaboratorsPerCampaign: { type: Number, required: true, min: -1 },
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

export const SubscriptionPlanModel = mongoose.model<SubscriptionPlanDocument>(
  'SubscriptionPlan',
  subscriptionPlanSchema
);
