import type {
  SubscriptionPlan,
  SubscriptionTier,
  UpdateSubscriptionPlanInput,
} from '@ubuntu-fund/types';

/**
 * Persistence for the admin-editable subscription plans. The `SUBSCRIPTION_PLANS`
 * constant seeds this collection ({@link seedDefaults}) and remains the safe
 * fallback that {@link PlanService} reads through when a row is missing.
 */
export interface SubscriptionPlanRepositoryPort {
  /** All persisted plans (any tier without a row is simply absent here). */
  findAll(): Promise<SubscriptionPlan[]>;
  /** A single plan by its tier, or null when no row has been seeded yet. */
  findByTier(tier: SubscriptionTier): Promise<SubscriptionPlan | null>;
  /**
   * Patch the editable fields of a plan (tier is immutable). Returns the updated
   * plan, or null when no row exists for the tier.
   */
  update(
    tier: SubscriptionTier,
    patch: UpdateSubscriptionPlanInput
  ): Promise<SubscriptionPlan | null>;
  /**
   * Upsert each `SUBSCRIPTION_PLANS[tier]` ONLY when that tier's row is absent.
   * Idempotent and never overwrites admin edits — safe to run on every boot.
   */
  seedDefaults(): Promise<void>;
}
