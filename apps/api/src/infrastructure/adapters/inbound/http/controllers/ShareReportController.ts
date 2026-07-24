import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ShareCampaignUseCase } from '../../../../../application/use-cases/ShareCampaignUseCase.js';
import type { ReportCampaignUseCase } from '../../../../../application/use-cases/ReportCampaignUseCase.js';

export class ShareReportController {
  constructor(
    private readonly shareCampaignUseCase: ShareCampaignUseCase,
    private readonly reportCampaignUseCase: ReportCampaignUseCase
  ) {}

  share = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.shareCampaignUseCase.execute(
        {
          campaignId: req.params.id as string,
          platform: req.body.platform,
        },
        req.userId!
      );
      res.status(201).json({
        data: null,
        message: 'Share recorded',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  report = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.reportCampaignUseCase.execute(
        {
          campaignId: req.params.id as string,
          reason: req.body.reason,
          description: req.body.description,
        },
        req.userId!
      );
      res.status(201).json({
        data: null,
        message: 'Report submitted',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };
}
