import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CreateCampaignUpdateUseCase } from '../../../../../application/use-cases/CreateCampaignUpdateUseCase.js';
import type { GetCampaignUpdatesUseCase } from '../../../../../application/use-cases/GetCampaignUpdatesUseCase.js';
import type { UpdateCampaignUpdateUseCase } from '../../../../../application/use-cases/UpdateCampaignUpdateUseCase.js';
import type { DeleteCampaignUpdateUseCase } from '../../../../../application/use-cases/DeleteCampaignUpdateUseCase.js';
import type { PinCampaignUpdateUseCase } from '../../../../../application/use-cases/PinCampaignUpdateUseCase.js';

export class CampaignUpdateController {
  constructor(
    private readonly createCampaignUpdateUseCase: CreateCampaignUpdateUseCase,
    private readonly getCampaignUpdatesUseCase: GetCampaignUpdatesUseCase,
    private readonly updateCampaignUpdateUseCase: UpdateCampaignUpdateUseCase,
    private readonly deleteCampaignUpdateUseCase: DeleteCampaignUpdateUseCase,
    private readonly pinCampaignUpdateUseCase: PinCampaignUpdateUseCase
  ) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const items = await this.getCampaignUpdatesUseCase.execute(
        req.params.id as string
      );
      res.json({
        data: { items },
        message: 'Campaign updates retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const update = await this.createCampaignUpdateUseCase.execute(
        req.params.id as string,
        req.body,
        req.userId!
      );
      res.status(201).json({
        data: update,
        message: 'Update posted successfully',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const update = await this.updateCampaignUpdateUseCase.execute(
        req.params.id as string,
        req.params.updateId as string,
        req.body,
        req.userId!
      );
      res.json({
        data: update,
        message: 'Update edited successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.deleteCampaignUpdateUseCase.execute(
        req.params.id as string,
        req.params.updateId as string,
        req.userId!
      );
      res.json({
        data: null,
        message: 'Update deleted successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  pin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const update = await this.pinCampaignUpdateUseCase.execute(
        req.params.id as string,
        req.params.updateId as string,
        req.userId!
      );
      res.json({
        data: update,
        message: 'Update pinned successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
