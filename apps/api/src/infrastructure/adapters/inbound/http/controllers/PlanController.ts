import type { Request, Response, NextFunction } from 'express';
import type { CreatePlanInput, UpdateSubscriptionPlanInput } from '@ubuntu-fund/types';
import type { ListPlansUseCase } from '../../../../../application/use-cases/ListPlansUseCase.js';
import type { UpdatePlanUseCase } from '../../../../../application/use-cases/UpdatePlanUseCase.js';
import type { CreatePlanUseCase } from '../../../../../application/use-cases/CreatePlanUseCase.js';

export class PlanController {
  constructor(
    private readonly listPlansUseCase: ListPlansUseCase,
    private readonly updatePlanUseCase: UpdatePlanUseCase,
    private readonly createPlanUseCase: CreatePlanUseCase
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

  /** POST /plans — admin only. Adds a new plan/tier. */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const plan = await this.createPlanUseCase.execute(
        req.body as CreatePlanInput
      );
      res.status(201).json({ data: plan, message: 'Plan created', status: 201 });
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
      const tier = String(req.params.tier);
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
