import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetProfileUseCase } from '../../../../../application/use-cases/GetProfileUseCase.js';
import type { UpdateProfileUseCase } from '../../../../../application/use-cases/UpdateProfileUseCase.js';
import type { GetPublicUserProfileUseCase } from '../../../../../application/use-cases/GetPublicUserProfileUseCase.js';
import type { DeleteAccountUseCase } from '../../../../../application/use-cases/DeleteAccountUseCase.js';

export class ProfileController {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly getPublicUserProfileUseCase: GetPublicUserProfileUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase
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
        req.body,
        req.authVersion ?? ''
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
        req.params.id as string,
        req.userId
      );
      res.set('Cache-Control', 'private, no-store').json({
        data: profile,
        message: 'Public profile retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getClosureCheck = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const preview = await this.deleteAccountUseCase.preview(req.userId!);
      res.set('Cache-Control', 'private, no-store').json({
        data: preview,
        message: 'Account closure check',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMyAccount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { password, code } = (req.body ?? {}) as { password?: string; code?: string };
      await this.deleteAccountUseCase.execute(req.userId!, { password, code });
      res.json({
        data: null,
        message: 'Account closed. Associated data deletion and retained-record review requested',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
