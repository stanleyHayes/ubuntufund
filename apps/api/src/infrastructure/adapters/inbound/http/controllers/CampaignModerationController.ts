import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type {
  ReviewCampaignUseCase,
  CampaignReviewAction,
} from '../../../../../application/use-cases/ReviewCampaignUseCase.js';

const ACTION_MESSAGES: Record<CampaignReviewAction, string> = {
  approve: 'Campaign approval recorded',
  reject: 'Campaign rejection recorded',
  block: 'Campaign block recorded',
  reopen: 'Return-to-review decision recorded',
};

export class CampaignModerationController {
  constructor(
    private readonly reviewCampaignUseCase: ReviewCampaignUseCase
  ) {}

  /**
   * PUT /campaigns/:id/approve
   * Body: { action?: 'approve' | 'reject' | 'block', reason?: string }
   * `action` defaults to 'approve' when omitted, matching the endpoint name.
   */
  approve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const action: CampaignReviewAction = req.body.action ?? 'approve';
      const campaign = await this.reviewCampaignUseCase.execute({
        campaignId: req.params.id as string,
        actorId: req.userId!, authVersion: req.authVersion ?? '',
        expectedVersion: req.body.expectedVersion,
        contentReviewed: req.body.contentReviewed, fundraisingReviewed: req.body.fundraisingReviewed,
        action,
        reason: req.body.reason,
      });
      res.json({
        data: campaign,
        message: ACTION_MESSAGES[action],
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /campaigns/:id/reject
   * Body: { reason: string }
   */
  reject = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const campaign = await this.reviewCampaignUseCase.execute({
        campaignId: req.params.id as string,
        actorId: req.userId!, authVersion: req.authVersion ?? '',
        expectedVersion: req.body.expectedVersion,
        contentReviewed: req.body.contentReviewed, fundraisingReviewed: req.body.fundraisingReviewed,
        action: 'reject',
        reason: req.body.reason,
      });
      res.json({
        data: campaign,
        message: ACTION_MESSAGES.reject,
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
