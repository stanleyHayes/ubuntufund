import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetMySubscriptionUseCase } from '../../../../../application/use-cases/GetMySubscriptionUseCase.js';
import type { SubscribeUseCase } from '../../../../../application/use-cases/SubscribeUseCase.js';
import type { UpgradeSubscriptionUseCase } from '../../../../../application/use-cases/UpgradeSubscriptionUseCase.js';
import type { CancelSubscriptionUseCase } from '../../../../../application/use-cases/CancelSubscriptionUseCase.js';

export class SubscriptionController {
  constructor(
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly subscribeUseCase: SubscribeUseCase,
    private readonly upgradeSubscriptionUseCase: UpgradeSubscriptionUseCase,
    private readonly cancelSubscriptionUseCase: CancelSubscriptionUseCase
  ) {}

  getMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const subscription = await this.getMySubscriptionUseCase.execute(req.userId!);
      res.json({
        data: subscription,
        message: 'Subscription retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  subscribe = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const subscription = await this.subscribeUseCase.execute(req.body, req.userId!);
      res.status(201).json({
        data: subscription,
        message: 'Subscribed successfully',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  upgrade = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const subscription = await this.upgradeSubscriptionUseCase.execute(
        req.body,
        req.userId!
      );
      res.json({
        data: subscription,
        message: 'Subscription upgraded successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  cancel = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const subscription = await this.cancelSubscriptionUseCase.execute(req.userId!);
      res.json({
        data: subscription,
        message: 'Subscription cancelled successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
