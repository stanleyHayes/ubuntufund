import {
  SubscriptionTier,
  type SubscriptionPlan,
  type UpdateSubscriptionPlanInput,
} from '@ubuntu-fund/types';
import type { SubscriptionPlanRepositoryPort } from '../../domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Money fields that must be zero or positive. */
const NON_NEGATIVE_FIELDS: (keyof UpdateSubscriptionPlanInput)[] = [
  'priceMonthly',
  'priceYearly',
];

/** Numeric limits where -1 means "unlimited", so the floor is -1. */
const LIMIT_FIELDS: (keyof UpdateSubscriptionPlanInput)[] = [
  'maxActiveCampaigns',
  'maxCampaignGoal',
  'maxMediaPerCampaign',
  'maxTeamMembers',
  'maxCollaboratorsPerCampaign',
];

/**
 * The complete set of editable fields. Anything outside this list (notably
 * `tier`, `id`, `_id`, timestamps) is dropped before writing, so a client can
 * never smuggle an immutable/unknown field into the update.
 */
const EDITABLE_FIELDS: (keyof UpdateSubscriptionPlanInput)[] = [
  'name',
  'description',
  'priceMonthly',
  'priceYearly',
  'platformFeePercent',
  ...LIMIT_FIELDS,
  'featuredListing',
  'prioritySupport',
  'advancedAnalytics',
  'customBranding',
  'escrowSupport',
  'liveStreaming',
  'campaignCollaboration',
];

/**
 * Applies an admin edit to a subscription plan's pricing/limits/benefits. The
 * plan's `tier` is immutable — it identifies the row and is never patched. All
 * numeric inputs are validated (prices ≥ 0, platform fee 0–100%, limits ≥ -1)
 * before anything is written.
 */
export class UpdatePlanUseCase {
  constructor(private readonly planRepo: SubscriptionPlanRepositoryPort) {}

  async execute(
    tier: SubscriptionTier,
    patch: UpdateSubscriptionPlanInput
  ): Promise<SubscriptionPlan> {
    if (!Object.values(SubscriptionTier).includes(tier)) {
      throw new AppError('Unknown subscription tier', 404);
    }

    // Keep only the editable fields; drop `tier` and any other smuggled/unknown
    // keys so the plan's identity can never be changed through an edit.
    const clean: UpdateSubscriptionPlanInput = {};
    for (const field of EDITABLE_FIELDS) {
      const value = patch[field];
      if (value !== undefined) {
        // `field` is a known editable key and `value` is its own value type, so
        // this single-key merge is type-safe without widening to any.
        Object.assign(clean, { [field]: value });
      }
    }

    this.validate(clean);

    if (Object.keys(clean).length === 0) {
      throw new AppError('No editable fields provided', 422);
    }

    // A not-yet-seeded DB (e.g. edit issued before the boot seed lands) still
    // gets a row to patch, so an admin edit is never silently dropped.
    const existing = await this.planRepo.findByTier(tier);
    if (!existing) {
      await this.planRepo.seedDefaults();
    }

    const updated = await this.planRepo.update(tier, clean);
    if (!updated) {
      throw new AppError('Plan not found', 404);
    }
    return updated;
  }

  private validate(patch: UpdateSubscriptionPlanInput): void {
    for (const field of NON_NEGATIVE_FIELDS) {
      const value = patch[field];
      if (typeof value === 'number' && value < 0) {
        throw new AppError(`${field} must be zero or greater`, 422);
      }
    }

    if (
      typeof patch.platformFeePercent === 'number' &&
      (patch.platformFeePercent < 0 || patch.platformFeePercent > 100)
    ) {
      throw new AppError('platformFeePercent must be between 0 and 100', 422);
    }

    for (const field of LIMIT_FIELDS) {
      const value = patch[field];
      if (typeof value === 'number' && value < -1) {
        throw new AppError(`${field} must be -1 (unlimited) or greater`, 422);
      }
    }
  }
}
