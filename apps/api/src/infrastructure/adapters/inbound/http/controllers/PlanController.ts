import type { Request, Response, NextFunction } from 'express';
import type { SubscriptionTier, UpdateSubscriptionPlanInput } from '@ubuntu-fund/types';
import type { ListPlansUseCase } from '../../../../../application/use-cases/ListPlansUseCase.js';
import type { UpdatePlanUseCase } from '../../../../../application/use-cases/UpdatePlanUseCase.js';

export class PlanController {
  constructor(
    private readonly listPlansUseCase: ListPlansUseCase,
    private readonly updatePlanUseCase: UpdatePlanUseCase
  ) {}

  /** GET /plans — authed display of all plans (DB-backed, defaults as fallback). */
  list = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const plans = await this.listPlansUseCase.execute();
      res.json({ data: plans, message: 'Plans retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** PUT /plans/:tier — admin only. Patches a plan's pricing/limits/benefits. */
  update = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const tier = req.params.tier as SubscriptionTier;
      const plan = await this.updatePlanUseCase.execute(
        tier,
        req.body as UpdateSubscriptionPlanInput
      );
      res.json({ data: plan, message: 'Plan updated', status: 200 });
    } catch (error) {
      next(error);
    }
  };
}
