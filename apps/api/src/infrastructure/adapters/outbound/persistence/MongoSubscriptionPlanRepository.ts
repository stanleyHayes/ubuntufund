import {
  SUBSCRIPTION_PLANS,
  SubscriptionTier,
  type CreatePlanInput,
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
    maxPayoutAccounts: doc.maxPayoutAccounts ?? SUBSCRIPTION_PLANS[doc.tier as SubscriptionTier]?.maxPayoutAccounts ?? 1,
    maxCollaboratorsPerCampaign: doc.maxCollaboratorsPerCampaign,
    sortOrder: doc.sortOrder ?? 0,
    active: doc.active ?? true,
    isPublic: doc.isPublic ?? true,
    accentColor: doc.accentColor ?? '#78909C',
    popular: doc.popular ?? false,
  };
}

export class MongoSubscriptionPlanRepository
  implements SubscriptionPlanRepositoryPort
{
  async findAll(): Promise<SubscriptionPlan[]> {
    const docs = await SubscriptionPlanModel.find();
    return docs.map(toDomain);
  }

  async findByTier(tier: string): Promise<SubscriptionPlan | null> {
    const doc = await SubscriptionPlanModel.findOne({ tier });
    return doc ? toDomain(doc) : null;
  }

  async create(input: CreatePlanInput): Promise<SubscriptionPlan | null> {
    // Unique tier key: a duplicate create is a no-op (returns null).
    const existing = await SubscriptionPlanModel.findOne({ tier: input.tier });
    if (existing) return null;
    const doc = await SubscriptionPlanModel.create({
      ...input,
      description: input.description ?? '',
    });
    return toDomain(doc);
  }

  async update(
    tier: string,
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
