import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListReportsUseCase } from '../../../../../application/use-cases/ListReportsUseCase.js';
import type { ReviewReportUseCase } from '../../../../../application/use-cases/ReviewReportUseCase.js';
import type { ReportStatus } from '../../../../../domain/ports/outbound/ReportRepositoryPort.js';
import { AppError } from '../../middleware/errorHandler.js';

export class AdminReportController {
  constructor(
    private readonly listReportsUseCase: ListReportsUseCase,
    private readonly reviewReportUseCase: ReviewReportUseCase
  ) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as ReportStatus | undefined;

      const result = await this.listReportsUseCase.list({
        page,
        pageSize,
        status,
      });

      res.json({
        data: result,
        message: 'Reports retrieved',
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
      const report = await this.listReportsUseCase.getById(
        req.params.id as string
      );
      if (!report) {
        throw new AppError('Report not found', 404);
      }
      res.json({
        data: report,
        message: 'Report retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  review = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updated = await this.reviewReportUseCase.execute(
        req.params.id as string,
        req.body
      );
      res.json({
        data: updated,
        message: 'Report reviewed',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
