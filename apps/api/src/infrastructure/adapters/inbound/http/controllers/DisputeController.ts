import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetDisputeUseCase } from '../../../../../application/use-cases/GetDisputeUseCase.js';
import type { ResolveDisputeUseCase } from '../../../../../application/use-cases/ResolveDisputeUseCase.js';
import type { RecordProviderReversalUseCase } from '../../../../../application/use-cases/RecordProviderReversalUseCase.js';
import type { DisputeStatus } from '../../../../../domain/ports/outbound/DisputeRepositoryPort.js';
import { AppError } from '../../middleware/errorHandler.js';

export class DisputeController {
  constructor(
    private readonly getDisputeUseCase: GetDisputeUseCase,
    private readonly resolveDisputeUseCase: ResolveDisputeUseCase,
    private readonly recordProviderReversalUseCase?: RecordProviderReversalUseCase
  ) {}

  /**
   * POST /disputes/:id/provider-reversal — record money the payment provider
   * already returned to the donor. Accounting only; never sends a refund.
   */
  recordProviderReversal = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.recordProviderReversalUseCase) throw new AppError('Provider reversals are unavailable', 503);
      const body = (req.body ?? {}) as { amount?: number };
      const result = await this.recordProviderReversalUseCase.execute(
        req.params.id as string,
        { amount: typeof body.amount === 'number' ? body.amount : undefined },
        req.userId!
      );
      res.status(result.reversal.status === 'PENDING_REVIEW' ? 202 : 200).json({
        data: result,
        message: result.reversal.status === 'PENDING_REVIEW'
          ? 'Reversal saved; local accounting needs a retry'
          : 'Provider reversal recorded',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

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
