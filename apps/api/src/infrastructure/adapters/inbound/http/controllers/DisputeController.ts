import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetDisputeUseCase } from '../../../../../application/use-cases/GetDisputeUseCase.js';
import type { ResolveDisputeUseCase } from '../../../../../application/use-cases/ResolveDisputeUseCase.js';
import type { DisputeStatus } from '../../../../../domain/ports/outbound/DisputeRepositoryPort.js';
import { AppError } from '../../middleware/errorHandler.js';

export class DisputeController {
  constructor(
    private readonly getDisputeUseCase: GetDisputeUseCase,
    private readonly resolveDisputeUseCase: ResolveDisputeUseCase
  ) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as DisputeStatus | undefined;

      const result = await this.getDisputeUseCase.list({
        page,
        pageSize,
        status,
      });

      res.json({
        data: result,
        message: 'Disputes retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const dispute = await this.getDisputeUseCase.getById(
        req.params.id as string
      );
      if (!dispute) {
        throw new AppError('Dispute not found', 404);
      }
      res.json({
        data: dispute,
        message: 'Dispute retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  resolve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.resolveDisputeUseCase.execute(
        req.params.id as string,
        req.body,
        req.userId!
      );
      res.json({
        data: updated,
        message: 'Dispute resolved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
