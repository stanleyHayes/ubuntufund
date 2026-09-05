import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetMySubscriptionUseCase } from '../../../../../application/use-cases/GetMySubscriptionUseCase.js';
import type { SubscribeUseCase } from '../../../../../application/use-cases/SubscribeUseCase.js';
import type { UpgradeSubscriptionUseCase } from '../../../../../application/use-cases/UpgradeSubscriptionUseCase.js';
import type { CancelSubscriptionUseCase } from '../../../../../application/use-cases/CancelSubscriptionUseCase.js';
import type { ListSubscriptionsUseCase } from '../../../../../application/use-cases/ListSubscriptionsUseCase.js';
import type { CreateSubscriptionCheckoutUseCase } from '../../../../../application/use-cases/CreateSubscriptionCheckoutUseCase.js';
import type { GetSubscriptionCheckoutUseCase } from '../../../../../application/use-cases/GetSubscriptionCheckoutUseCase.js';

export class SubscriptionController {
  constructor(
    private readonly getMySubscriptionUseCase: GetMySubscriptionUseCase,
    private readonly subscribeUseCase: SubscribeUseCase,
    private readonly upgradeSubscriptionUseCase: UpgradeSubscriptionUseCase,
    private readonly cancelSubscriptionUseCase: CancelSubscriptionUseCase,
    private readonly listSubscriptionsUseCase: ListSubscriptionsUseCase,
    private readonly createSubscriptionCheckoutUseCase: CreateSubscriptionCheckoutUseCase,
    private readonly getSubscriptionCheckoutUseCase: GetSubscriptionCheckoutUseCase
  ) {}

  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.listSubscriptionsUseCase.execute();
      res.json({ data: { items }, message: 'Subscriptions retrieved', status: 200 });
    } catch (error) { next(error); }
  };

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

  /**
   * POST /subscriptions/checkout — open a paid-subscription checkout. Returns a
   * Paystack authorization URL, or (when a coupon zeroes the price) an activated
   * subscription with no charge.
   */
  createCheckout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.createSubscriptionCheckoutUseCase.execute(
        req.body,
        req.userId!
      );
      res.status(201).json({
        data: result,
        message: 'Subscription checkout created',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /subscriptions/checkout/:id — poll a checkout's status (owner). */
  getCheckout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const checkout = await this.getSubscriptionCheckoutUseCase.execute(
        req.params.id as string,
        req.userId!
      );
      res.json({
        data: checkout,
        message: 'Subscription checkout retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
