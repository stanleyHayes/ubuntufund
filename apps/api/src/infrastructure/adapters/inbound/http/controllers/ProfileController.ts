import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetProfileUseCase } from '../../../../../application/use-cases/GetProfileUseCase.js';
import type { UpdateProfileUseCase } from '../../../../../application/use-cases/UpdateProfileUseCase.js';
import type { GetPublicUserProfileUseCase } from '../../../../../application/use-cases/GetPublicUserProfileUseCase.js';

export class ProfileController {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly getPublicUserProfileUseCase: GetPublicUserProfileUseCase
  ) {}

  getMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.getProfileUseCase.execute(req.userId!);
      res.json({
        data: profile,
        message: 'Profile retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMyProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.updateProfileUseCase.execute(
        req.userId!,
        req.body
      );
      res.json({
        data: profile,
        message: 'Profile updated successfully',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getPublicProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const profile = await this.getPublicUserProfileUseCase.execute(
        req.params.id as string
      );
      res.json({
        data: profile,
        message: 'Public profile retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
