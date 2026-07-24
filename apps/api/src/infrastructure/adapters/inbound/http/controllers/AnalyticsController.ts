import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetPlatformOverviewUseCase } from '../../../../../application/use-cases/GetPlatformOverviewUseCase.js';

export class AnalyticsController {
  constructor(
    private readonly getPlatformOverviewUseCase: GetPlatformOverviewUseCase
  ) {}

  overview = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const overview = await this.getPlatformOverviewUseCase.execute();

      res.json({
        data: overview,
        message: 'Platform overview retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
