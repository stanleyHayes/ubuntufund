import {
  SUBSCRIPTION_PLANS,
  SubscriptionTier,
  type SubscriptionPlan,
} from '@ubuntu-fund/types';
import type { SubscriptionPlanRepositoryPort } from '../../domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

/** Stable display/order of tiers (cheapest → richest). */
const TIER_ORDER: SubscriptionTier[] = [
  SubscriptionTier.FREE,
  SubscriptionTier.STARTER,
  SubscriptionTier.PRO,
  SubscriptionTier.ENTERPRISE,
];

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
  async getPlan(tier: SubscriptionTier): Promise<SubscriptionPlan> {
    try {
      const plan = await this.planRepo.findByTier(tier);
      return plan ?? SUBSCRIPTION_PLANS[tier];
    } catch (error) {
      logger.error({ err: error, tier }, 'plan lookup failed; using default');
      return SUBSCRIPTION_PLANS[tier];
    }
  }

  /**
   * Every tier's plan in a stable order — the DB row where one exists, the
   * seeded default otherwise. A read failure falls back to the full default set
   * so the plans surface is never empty.
   */
  async getAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const rows = await this.planRepo.findAll();
      const byTier = new Map(rows.map((plan) => [plan.tier, plan]));
      return TIER_ORDER.map((tier) => byTier.get(tier) ?? SUBSCRIPTION_PLANS[tier]);
    } catch (error) {
      logger.error({ err: error }, 'plan list failed; using defaults');
      return TIER_ORDER.map((tier) => SUBSCRIPTION_PLANS[tier]);
    }
  }
}
