import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListSiteContentUseCase } from '../../../../../application/use-cases/ListSiteContentUseCase.js';
import type { GetSiteContentUseCase } from '../../../../../application/use-cases/GetSiteContentUseCase.js';
import type { UpsertSiteContentUseCase } from '../../../../../application/use-cases/UpsertSiteContentUseCase.js';

export class SiteContentController {
  constructor(
    private readonly listSiteContentUseCase: ListSiteContentUseCase,
    private readonly getSiteContentUseCase: GetSiteContentUseCase,
    private readonly upsertSiteContentUseCase: UpsertSiteContentUseCase
  ) {}

  // Public: GET /content — every block in one shot for the marketing site.
  list = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const blocks = await this.listSiteContentUseCase.execute();
      res.json({
        data: blocks,
        message: 'Site content retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  // Public: GET /content/:key — a single block; 404 when the key is unknown.
  getByKey = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const key = req.params.key as string;
      const block = await this.getSiteContentUseCase.execute(key);
      if (!block) {
        res.status(404).json({
          message: `No content found for key '${key}'`,
          status: 404,
        });
        return;
      }
      res.json({
        data: block,
        message: 'Site content retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  // Admin-only: PUT /content/:key — guarded by authMiddleware + requireAdmin.
  upsert = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const block = await this.upsertSiteContentUseCase.execute({
        key: req.params.key as string,
        type: req.body?.type,
        data: req.body?.data,
        updatedBy: req.userId,
      });
      res.json({
        data: block,
        message: 'Site content updated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
