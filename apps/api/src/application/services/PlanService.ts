import {
  SUBSCRIPTION_PLANS,
  SubscriptionTier,
  type SubscriptionPlan,
} from '@ubuntu-fund/types';
import type { SubscriptionPlanRepositoryPort } from '../../domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** Seed plans keyed by their (string) tier id, for fallback lookups. */
const SEEDS = SUBSCRIPTION_PLANS as Record<string, SubscriptionPlan>;

/** Order a plan list cheapest → richest by admin-set sortOrder, then price. */
function bySortOrder(a: SubscriptionPlan, b: SubscriptionPlan): number {
  return a.sortOrder - b.sortOrder || a.priceMonthly - b.priceMonthly;
}

/**
 * The single source of truth the rest of the app reads plan pricing + limits
 * through. It resolves a tier's plan from the DB (where admins edit it) and
 * falls back to the code-defined {@link SUBSCRIPTION_PLANS} whenever a row is
 * missing OR a read throws — so pricing, limits, and feature gates never break
 * even if the database is unavailable.
 */
export class PlanService {
  constructor(private readonly planRepo: SubscriptionPlanRepositoryPort) {}

  /**
   * The plan for a tier: the DB row when present, otherwise the seeded default.
   * A read failure is logged and swallowed, returning the default so callers
   * (limit enforcement, checkout pricing) keep working.
   */
  async getPlan(tier: string): Promise<SubscriptionPlan> {
    try {
      const plan = await this.planRepo.findByTier(tier);
      // DB row → seed for that tier → the free seed (safe floor for an unknown
      // or since-deleted tier, so limit enforcement never crashes).
      return plan ?? SEEDS[tier] ?? SEEDS[SubscriptionTier.FREE];
    } catch (error) {
      logger.error({ err: error, tier }, 'plan lookup failed; using default');
      return SEEDS[tier] ?? SEEDS[SubscriptionTier.FREE];
    }
  }

  /**
   * Every plan in a stable cheapest→richest order: the union of the persisted
   * plans (including admin-ADDED tiers) and any seed tier not yet in the DB,
   * sorted by the admin-set `sortOrder`. A read failure falls back to the full
   * seed set so the plans surface is never empty.
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const rows = await this.planRepo.findAll();
      const byTier = new Map(rows.map((plan) => [plan.tier, plan]));
      // Ensure the built-in seed tiers always appear, even before seeding runs.
      for (const seed of Object.values(SUBSCRIPTION_PLANS)) {
        if (!byTier.has(seed.tier)) byTier.set(seed.tier, seed);
      }
      return [...byTier.values()].sort(bySortOrder);
    } catch (error) {
      logger.error({ err: error }, 'plan list failed; using defaults');
      return Object.values(SUBSCRIPTION_PLANS).sort(bySortOrder);
    }
  }
}
