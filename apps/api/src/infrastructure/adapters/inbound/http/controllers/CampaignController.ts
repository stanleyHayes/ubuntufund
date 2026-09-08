import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateCampaignUseCase } from '../../../../../application/use-cases/CreateCampaignUseCase.js';
import type { GetCampaignUseCase } from '../../../../../application/use-cases/GetCampaignUseCase.js';
import type { DonateToCampaignUseCase } from '../../../../../application/use-cases/DonateToCampaignUseCase.js';
import type { GetCampaignBySlugUseCase } from '../../../../../application/use-cases/GetCampaignBySlugUseCase.js';
import type { SetCampaignSlugUseCase } from '../../../../../application/use-cases/SetCampaignSlugUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

import type { PlanLimitsService } from '../../../../../application/services/PlanLimitsService.js';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../../../../domain/ports/outbound/CampaignRepositoryPort.js';

export class CampaignController {
  constructor(
    private readonly createCampaignUseCase: CreateCampaignUseCase,
    private readonly getCampaignUseCase: GetCampaignUseCase,
    private readonly donateToCampaignUseCase: DonateToCampaignUseCase,
    private readonly getCampaignBySlugUseCase: GetCampaignBySlugUseCase,
    private readonly setCampaignSlugUseCase: SetCampaignSlugUseCase,
    private readonly planLimits: PlanLimitsService,
    private readonly userRepo: UserRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly splitEnabled: boolean
  ) {}

  creationOptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId!;
      const [plan, user, activeCount, totalCount] = await Promise.all([
        this.planLimits.resolvePlan(userId), this.userRepo.findById(userId),
        this.campaignRepo.countActiveByCreator(userId), this.campaignRepo.countByCreatorId(userId),
      ]);
      if (!user) throw new AppError('User not found', 404);
      const creationBlockReason = !user.canCreateCampaign(totalCount)
        ? (user.getCampaignLimit() === 0 ? 'verification_required' : 'verification_limit')
        : plan.maxActiveCampaigns >= 0 && activeCount >= plan.maxActiveCampaigns
          ? 'plan_limit' : null;
      res.json({ data: {
        plan, maxGoal: this.planLimits.effectiveGoalCap(plan.maxCampaignGoal, user.complianceApprovedCampaignLimit) ?? null,
        activeCount, totalCount, verificationCampaignLimit: user.getCampaignLimit(),
        canCreate: creationBlockReason === null, creationBlockReason,
        canSplit: this.splitEnabled && plan.campaignCollaboration && plan.escrowSupport,
        splitEnabled: this.splitEnabled,
      } });
    } catch (error) { next(error); }
  };

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

  getBySlugPublic = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const view = await this.getCampaignBySlugUseCase.execute(
        req.params.slug as string
      );
      if (!view) {
        throw new AppError('Campaign not found', 404);
      }
      res.json({
        data: view,
        message: 'Campaign retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  setSlug = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await this.setCampaignSlugUseCase.execute(
        req.params.id as string,
        req.body.slug as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({
        data: campaign,
        message: 'Campaign slug updated',
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

  listMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaigns = await this.getCampaignUseCase.listByCreator(req.userId!);
      res.json({
        data: campaigns,
        message: 'Your campaigns retrieved',
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
