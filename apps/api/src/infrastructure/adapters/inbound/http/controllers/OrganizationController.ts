import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { Response, NextFunction } from 'express';
import type { GetOrganizationUseCase } from '../../../../../application/use-cases/GetOrganizationUseCase.js';

export class OrganizationController {
  constructor(
    private readonly getOrganizationUseCase: GetOrganizationUseCase
  ) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const organizations = await this.getOrganizationUseCase.list(req.userId);
      res.json({
        data: organizations,
        message: 'Organizations retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const organization = await this.getOrganizationUseCase.getBySlugOrId(
        req.params.slug as string, req.userId
      );
      res.json({
        data: organization,
        message: 'Organization retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getCampaigns = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaigns = await this.getOrganizationUseCase.getCampaigns(
        req.params.id as string, req.userId
      );
      res.json({
        data: campaigns,
        message: 'Organization campaigns retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
