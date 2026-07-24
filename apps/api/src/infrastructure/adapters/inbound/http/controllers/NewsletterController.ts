import type { Request, Response, NextFunction } from 'express';
import type { SubscribeNewsletterUseCase } from '../../../../../application/use-cases/SubscribeNewsletterUseCase.js';
import type { ListNewsletterSubscribersUseCase } from '../../../../../application/use-cases/ListNewsletterSubscribersUseCase.js';

export class NewsletterController {
  constructor(
    private readonly subscribeNewsletterUseCase: SubscribeNewsletterUseCase,
    private readonly listNewsletterSubscribersUseCase: ListNewsletterSubscribersUseCase
  ) {}

  subscribe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.subscribeNewsletterUseCase.execute(req.body);
      res.status(200).json({
        data: { message: result.message },
        message: 'Subscribed to newsletter',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin-only: guarded by authMiddleware + requireAdmin at the route layer.
  listSubscribers = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const subscribers = await this.listNewsletterSubscribersUseCase.execute();
      res.json({
        data: subscribers,
        message: 'Newsletter subscribers retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
