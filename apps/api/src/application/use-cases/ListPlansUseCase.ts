import type { SubscriptionPlan } from '@ubuntu-fund/types';
import type { PlanService } from '../services/PlanService.js';

/**
 * Lists every subscription plan (DB-backed, with the code defaults as a safe
 * fallback) for the admin plan editor and the web pricing surfaces.
 */
export class ListPlansUseCase {
  constructor(private readonly planService: PlanService) {}

  execute(strict = false): Promise<SubscriptionPlan[]> {
    return this.planService.getAllPlans(strict);
  }
}
