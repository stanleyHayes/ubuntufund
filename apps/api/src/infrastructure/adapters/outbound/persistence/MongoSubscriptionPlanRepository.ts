import { AppError } from '../../inbound/middleware/errorHandler.js';
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
import { logger } from '../../../logging/logger.js';

/** What a price-book drift report compares: the commercial headline of a plan. */
const DRIFT_FIELDS = ['name', 'priceMonthly', 'priceYearly', 'platformFeePercent', 'sortOrder'] as const;

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
    // Rows written before the collaborator cap existed (the launch rows) have
    // none, and enforcement reads a missing cap as no cap at all. They take
    // their tier's built-in cap instead; Enterprise's -1 keeps it unlimited.
    maxCollaboratorsPerCampaign:
      doc.maxCollaboratorsPerCampaign ??
      SUBSCRIPTION_PLANS[doc.tier as SubscriptionTier]?.maxCollaboratorsPerCampaign ??
      0,
    // A paid capability that decides who can collect money for someone else
    // is never inherited from seed data: rows written before it existed read
    // as "not included" until an admin turns it on (an audited plan update).
    onBehalfCampaigns: doc.onBehalfCampaigns ?? false,
    maxOnBehalfCampaigns: doc.maxOnBehalfCampaigns ?? 0,
    onBehalfFeePercent: doc.onBehalfFeePercent ?? 0,
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
  async lockForConsumption(tier: string): Promise<void> {
    const defaults = Object.prototype.hasOwnProperty.call(SUBSCRIPTION_PLANS, tier)
      ? SUBSCRIPTION_PLANS[tier as SubscriptionTier] : undefined;
    // Built-in defaults are real policy: insert them atomically before consuming
    // them so a concurrent first insertion cannot bypass the transaction lock.
    const result = await SubscriptionPlanModel.updateOne({ tier }, {
      $inc: { consumptionWriteVersion: 1 },
      ...(defaults ? { $setOnInsert: { ...defaults, createdAt: new Date(), updatedAt: new Date() } } : {}),
    }, { upsert: !!defaults, timestamps: false });
    if (!result.matchedCount && !result.upsertedCount) {
      throw new AppError('This plan is no longer available. Refresh your subscription before withdrawing.', 409);
    }
  }
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
   * filter makes the operation idempotent across restarts. Timestamps are set
   * here, on insert only: Mongoose's own added `$set.updatedAt`, so every boot
   * re-stamped every row and `updatedAt` stopped saying when a plan was edited.
   *
   * Then reports, never overwrites, stored built-in plans that differ from the
   * code price book: a repricing in code does not reach existing rows.
   */
  async seedDefaults(): Promise<void> {
    const now = new Date();
    await Promise.all(
      Object.values(SubscriptionTier).map((tier) =>
        SubscriptionPlanModel.updateOne(
          { tier },
          { $setOnInsert: { ...SUBSCRIPTION_PLANS[tier], createdAt: now, updatedAt: now } },
          { upsert: true, timestamps: false }
        )
      )
    );
    await this.reportDriftFromDefaults();
  }

  /**
   * One warning per built-in tier whose stored name, prices, fee or order
   * differ from SUBSCRIPTION_PLANS. Best effort: seeding already succeeded.
   */
  private async reportDriftFromDefaults(): Promise<void> {
    try {
      const docs = await SubscriptionPlanModel.find({ tier: { $in: Object.values(SubscriptionTier) } });
      for (const doc of docs) {
        const seed = SUBSCRIPTION_PLANS[doc.tier as SubscriptionTier];
        const differences = DRIFT_FIELDS.filter((field) => doc[field] !== seed[field])
          .map((field) => ({ field, stored: doc[field], code: seed[field] }));
        if (differences.length === 0) continue;
        const summary = differences.map((d) => `${d.field} ${d.stored} (code ${d.code})`).join(', ');
        logger.warn({ tier: doc.tier, differences }, `Plan "${doc.tier}" differs from the code price book: ${summary}`);
      }
    } catch (error) {
      logger.warn({ err: error }, 'could not compare stored plans with the code price book');
    }
  }
}
