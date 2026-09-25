import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListReportsUseCase } from '../../../../../application/use-cases/ListReportsUseCase.js';
import type { ReviewReportUseCase } from '../../../../../application/use-cases/ReviewReportUseCase.js';
import type { ReportStatus } from '../../../../../domain/ports/outbound/ReportRepositoryPort.js';
import { AppError } from '../../middleware/errorHandler.js';
import { queuePageSize } from '../../middleware/queuePageSize.js';

const REPORT_STATUSES: ReportStatus[] = ['pending', 'reviewed', 'dismissed'];
const OBJECT_ID = /^[a-f0-9]{24}$/i;

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
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      // Bounded like every other admin queue; an unbounded pageSize let one
      // request load the whole collection.
      const pageSize = queuePageSize(req.query.pageSize);
      const rawStatus = req.query.status;
      if (rawStatus !== undefined && !REPORT_STATUSES.includes(rawStatus as ReportStatus)) {
        throw new AppError('Status must be pending, reviewed or dismissed', 400);
      }
      const status = rawStatus as ReportStatus | undefined;
      res.set('Cache-Control', 'private, no-store');

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
      if (!OBJECT_ID.test(String(req.params.id))) {
        throw new AppError('Report not found', 404);
      }
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
      if (!OBJECT_ID.test(String(req.params.id))) {
        throw new AppError('Report not found', 404);
      }
      if (!req.userId) throw new AppError('Authentication required', 401);
      const updated = await this.reviewReportUseCase.execute(
        req.params.id as string,
        { status: req.body.status, notes: req.body.notes },
        req.userId
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
