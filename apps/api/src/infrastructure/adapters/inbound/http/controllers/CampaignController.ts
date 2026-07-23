import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateCampaignUseCase } from '../../../../../application/use-cases/CreateCampaignUseCase.js';
import type { GetCampaignUseCase } from '../../../../../application/use-cases/GetCampaignUseCase.js';
import type { DonateToCampaignUseCase } from '../../../../../application/use-cases/DonateToCampaignUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

export class CampaignController {
  constructor(
    private readonly createCampaignUseCase: CreateCampaignUseCase,
    private readonly getCampaignUseCase: GetCampaignUseCase,
    private readonly donateToCampaignUseCase: DonateToCampaignUseCase
  ) {}

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await this.createCampaignUseCase.execute(
        req.body,
        req.userId!
      );
      res.status(201).json({
        data: campaign,
        message: 'Campaign created successfully',
        status: 201,
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
      const campaign = await this.getCampaignUseCase.getById(req.params.id as string);
      if (!campaign) {
        throw new AppError('Campaign not found', 404);
      }
      res.json({
        data: campaign,
        message: 'Campaign retrieved',
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
      const sortBy = (req.query.sortBy as string) ?? 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') ?? 'desc';

      const result = await this.getCampaignUseCase.list({
        page,
        pageSize,
        sortBy,
        sortOrder,
      });

      res.json({
        data: result,
        message: 'Campaigns retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  donate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.donateToCampaignUseCase.execute(
        { ...req.body, campaignId: req.params.id as string },
        req.userId!
      );
      res.json({
        data: null,
        message: 'Donation successful',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
