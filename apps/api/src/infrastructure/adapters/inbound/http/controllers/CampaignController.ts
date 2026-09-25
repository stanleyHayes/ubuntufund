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
import {
  CAMPAIGN_LIST_SORT_FIELDS,
  type CampaignListQuery,
  type CampaignListSortField,
  type CampaignListStatus,
  type CampaignRepositoryPort,
} from '../../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import { CampaignCategory, CampaignStatus } from '@ubuntu-fund/types';

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
/** Effective statuses anyone may filter public listings by. */
const PUBLIC_LIST_STATUSES: CampaignListStatus[] = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED, 'open'];
/** Staff can also find campaigns that are not public (e.g. the pending-review queue). */
const ADMIN_LIST_STATUSES: CampaignListStatus[] = [...PUBLIC_LIST_STATUSES, CampaignStatus.PENDING_REVIEW, CampaignStatus.BLOCKED, CampaignStatus.DRAFT];

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Parse and bound the public listing query; unknown filters are refused rather than ignored. */
function parseListQuery(query: Record<string, unknown>, isAdmin: boolean): CampaignListQuery {
  const page = Math.max(1, parseInt(queryString(query.page) ?? '', 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(queryString(query.pageSize) ?? '', 10) || 20));
  const sortBy = queryString(query.sortBy) ?? 'createdAt';
  if (!(CAMPAIGN_LIST_SORT_FIELDS as readonly string[]).includes(sortBy)) throw new AppError('Unsupported sort field', 400);
  const sortOrder = queryString(query.sortOrder) ?? 'desc';
  if (sortOrder !== 'asc' && sortOrder !== 'desc') throw new AppError('Unsupported sort order', 400);
  let status = queryString(query.status);
  if (status && !ADMIN_LIST_STATUSES.includes(status as CampaignListStatus)) throw new AppError('Unsupported status filter', 400);
  // Like a spoofed `includeNonPublic`, a non-staff request for a non-public
  // state is ignored: the listing stays public-only either way.
  if (status && !isAdmin && !PUBLIC_LIST_STATUSES.includes(status as CampaignListStatus)) status = undefined;
  const category = queryString(query.category);
  if (category && !(Object.values(CampaignCategory) as string[]).includes(category)) throw new AppError('Unsupported category filter', 400);
  const q = queryString(query.q);
  if (q && q.length > MAX_SEARCH_LENGTH) throw new AppError(`Search is limited to ${MAX_SEARCH_LENGTH} characters`, 400);
  return {
    page, pageSize, sortBy: sortBy as CampaignListSortField, sortOrder,
    ...(status ? { status: status as CampaignListStatus } : {}),
    ...(category ? { category: category as CampaignCategory } : {}),
    ...(q ? { q } : {}),
  };
}

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
      const allowance = await this.createCampaignUseCase.campaignAllowance(user);
      const creationBlockReason = totalCount >= allowance
        ? (allowance === 0 ? 'verification_required' : 'verification_limit')
        : plan.maxActiveCampaigns >= 0 && activeCount >= plan.maxActiveCampaigns
          ? 'plan_limit' : null;
      res.json({ data: {
        plan, maxGoal: this.planLimits.effectiveGoalCap(plan.maxCampaignGoal, user.complianceApprovedCampaignLimit) ?? null,
        activeCount, totalCount, verificationCampaignLimit: allowance,
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
      const campaign = await this.getCampaignUseCase.getById(req.params.id as string, req.userId, req.userRole === 'admin');
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
        { userId: req.userId!, role: req.userRole },
        req.body.automatedReviewConsent === true
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
      const isAdmin = req.userRole === 'admin';
      const result = await this.getCampaignUseCase.list(parseListQuery(req.query, isAdmin), isAdmin);

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
