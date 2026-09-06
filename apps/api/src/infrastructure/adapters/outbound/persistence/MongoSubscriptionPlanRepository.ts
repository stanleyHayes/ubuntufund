import {
  SUBSCRIPTION_PLANS,
  SubscriptionTier,
  type SubscriptionPlan,
  type UpdateSubscriptionPlanInput,
} from '@ubuntu-fund/types';
import type { SubscriptionPlanRepositoryPort } from '../../../../domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import {
  SubscriptionPlanModel,
  type SubscriptionPlanDocument,
} from '../../../database/models/SubscriptionPlanModel.js';

/** Maps a persisted document onto the plain {@link SubscriptionPlan} shape. */
function toDomain(doc: SubscriptionPlanDocument): SubscriptionPlan {
  return {
    tier: doc.tier,
    name: doc.name,
    description: doc.description,
    priceMonthly: doc.priceMonthly,
    priceYearly: doc.priceYearly,
    platformFeePercent: doc.platformFeePercent,
    maxActiveCampaigns: doc.maxActiveCampaigns,
    maxCampaignGoal: doc.maxCampaignGoal,
    featuredListing: doc.featuredListing,
    prioritySupport: doc.prioritySupport,
    advancedAnalytics: doc.advancedAnalytics,
    customBranding: doc.customBranding,
    maxMediaPerCampaign: doc.maxMediaPerCampaign,
    escrowSupport: doc.escrowSupport,
    liveStreaming: doc.liveStreaming,
    maxTeamMembers: doc.maxTeamMembers,
    campaignCollaboration: doc.campaignCollaboration,
    maxCollaboratorsPerCampaign: doc.maxCollaboratorsPerCampaign,
  };
}

export class MongoSubscriptionPlanRepository
  implements SubscriptionPlanRepositoryPort
{
  async findAll(): Promise<SubscriptionPlan[]> {
    const docs = await SubscriptionPlanModel.find();
    return docs.map(toDomain);
  }

  async findByTier(tier: SubscriptionTier): Promise<SubscriptionPlan | null> {
    const doc = await SubscriptionPlanModel.findOne({ tier });
    return doc ? toDomain(doc) : null;
  }

  async update(
    tier: SubscriptionTier,
    patch: UpdateSubscriptionPlanInput
  ): Promise<SubscriptionPlan | null> {
    // `tier` is the immutable key; only the editable fields in `patch` are set.
    const doc = await SubscriptionPlanModel.findOneAndUpdate(
      { tier },
      { $set: patch },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  /**
   * Seed a row for each tier ONLY when it is absent. `$setOnInsert` guarantees an
   * existing row (including admin edits) is never touched, and the per-tier
   * filter makes the operation idempotent across restarts.
   */
  async seedDefaults(): Promise<void> {
    await Promise.all(
      Object.values(SubscriptionTier).map((tier) =>
        SubscriptionPlanModel.updateOne(
          { tier },
          { $setOnInsert: SUBSCRIPTION_PLANS[tier] },
          { upsert: true }
        )
      )
    );
  }
}
