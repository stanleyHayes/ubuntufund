import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { RequestRefundUseCase } from '../../../../../application/use-cases/RequestRefundUseCase.js';
import type { ListMyRefundsUseCase } from '../../../../../application/use-cases/ListMyRefundsUseCase.js';

export class RefundController {
  constructor(
    private readonly requestRefundUseCase: RequestRefundUseCase,
    private readonly listMyRefundsUseCase: ListMyRefundsUseCase
  ) {}

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.requestRefundUseCase.execute(
        req.body,
        req.userId!
      );
      res.status(201).json({
        data: result,
        message: 'Refund request submitted',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  listMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const refunds = await this.listMyRefundsUseCase.execute(req.userId!);
      res.json({
        data: refunds,
        message: 'Refunds retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
