import type {
  CreatePlanInput,
  SubscriptionPlan,
  UpdateSubscriptionPlanInput,
} from '@ubuntu-fund/types';

/**
 * Persistence for the admin-managed subscription plans. The `SUBSCRIPTION_PLANS`
 * constant seeds this collection ({@link seedDefaults}) and remains the safe
 * fallback that {@link PlanService} reads through when a row is missing.
 * Administrators can also ADD new tiers ({@link create}) — `tier` is a free-form
 * id, not a fixed enum.
 */
export interface SubscriptionPlanRepositoryPort {
  /** All persisted plans (any tier without a row is simply absent here). */
  findAll(): Promise<SubscriptionPlan[]>;
  /** A single plan by its tier, or null when no row has been seeded yet. */
  findByTier(tier: string): Promise<SubscriptionPlan | null>;
  /**
   * Create a brand-new plan/tier. Returns null when a plan already exists for the
   * given tier id (the unique key).
   */
  create(input: CreatePlanInput): Promise<SubscriptionPlan | null>;
  /**
   * Patch the editable fields of a plan (tier is immutable). Returns the updated
   * plan, or null when no row exists for the tier.
   */
  update(
    tier: string,
    patch: UpdateSubscriptionPlanInput
  ): Promise<SubscriptionPlan | null>;
  /**
   * Upsert each `SUBSCRIPTION_PLANS[tier]` ONLY when that tier's row is absent.
   * Idempotent and never overwrites admin edits — safe to run on every boot.
   */
  seedDefaults(): Promise<void>;
}
