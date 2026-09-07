import type { CreatePlanInput, SubscriptionPlan } from '@ubuntu-fund/types';
import type { SubscriptionPlanRepositoryPort } from '../../domain/ports/outbound/SubscriptionPlanRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

/** Numeric limits where -1 means "unlimited" (floor -1); the rest floor at 0. */
const LIMIT_FIELDS: (keyof CreatePlanInput)[] = [
  'maxActiveCampaigns',
  'maxCampaignGoal',
  'maxMediaPerCampaign',
  'maxTeamMembers',
  'maxCollaboratorsPerCampaign',
];

/**
 * Creates a NEW subscription plan/tier from the admin dashboard (v6 §16 — plans
 * are admin-managed, not hard-coded). The `tier` is a free-form id that becomes
 * the plan's immutable key; a duplicate id is rejected with 409. All monetary and
 * limit inputs are validated before anything is written.
 */
export class CreatePlanUseCase {
  constructor(private readonly planRepo: SubscriptionPlanRepositoryPort) {}

  async execute(input: CreatePlanInput): Promise<SubscriptionPlan> {
    const tier = input.tier?.trim();
    if (!tier) {
      throw new AppError('A tier id is required', 422);
    }
    if (!input.name?.trim()) {
      throw new AppError('A plan name is required', 422);
    }
    if (input.priceMonthly < 0 || input.priceYearly < 0) {
      throw new AppError('Prices must be zero or greater', 422);
    }
    if (input.platformFeePercent < 0 || input.platformFeePercent > 100) {
      throw new AppError('platformFeePercent must be between 0 and 100', 422);
    }
    for (const field of LIMIT_FIELDS) {
      const value = input[field];
      if (typeof value === 'number' && value < -1) {
        throw new AppError(`${field} must be -1 (unlimited) or greater`, 422);
      }
    }

    const created = await this.planRepo.create({ ...input, tier });
    if (!created) {
      throw new AppError('A plan with this tier id already exists', 409);
    }
    return created;
  }
}
