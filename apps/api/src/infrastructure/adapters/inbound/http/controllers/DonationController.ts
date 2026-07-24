import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListRecentDonationsUseCase } from '../../../../../application/use-cases/ListRecentDonationsUseCase.js';
import type { ListMyDonationsUseCase } from '../../../../../application/use-cases/ListMyDonationsUseCase.js';
import type { GetDonationUseCase } from '../../../../../application/use-cases/GetDonationUseCase.js';
import type { ListCampaignDonationsUseCase } from '../../../../../application/use-cases/ListCampaignDonationsUseCase.js';

export class DonationController {
  constructor(
    private readonly listRecentDonationsUseCase: ListRecentDonationsUseCase,
    private readonly listMyDonationsUseCase: ListMyDonationsUseCase,
    private readonly getDonationUseCase: GetDonationUseCase,
    private readonly listCampaignDonationsUseCase: ListCampaignDonationsUseCase
  ) {}

  /** GET /donations?limit=N — recent public donations across all campaigns. */
  listRecent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : undefined;

      const donations = await this.listRecentDonationsUseCase.execute(limit);

      res.json({
        data: donations,
        message: 'Recent donations retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /donations/mine — the authenticated donor's own donation history. */
  listMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const donations = await this.listMyDonationsUseCase.execute(
        req.userId!
      );

      res.json({
        data: donations,
        message: 'Your donations retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /donations/:id — a single donation owned by the requesting user. */
  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const donation = await this.getDonationUseCase.execute(
        req.params.id as string,
        req.userId!
      );

      res.json({
        data: donation,
        message: 'Donation retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /campaigns/:id/donations?page=&pageSize= — paginated public donations for a campaign. */
  listByCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const result = await this.listCampaignDonationsUseCase.execute(
        req.params.id as string,
        { page, pageSize }
      );

      res.json({
        data: result,
        message: 'Campaign donations retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
