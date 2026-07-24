import type { Request, Response, NextFunction } from 'express';
import type { RegisterUserUseCase } from '../../../../../application/use-cases/RegisterUserUseCase.js';
import type { LoginUserUseCase } from '../../../../../application/use-cases/LoginUserUseCase.js';
import type { ChangePasswordUseCase } from '../../../../../application/use-cases/ChangePasswordUseCase.js';
import type {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../../../../../application/use-cases/ForgotPasswordUseCase.js';
import type { AuthTokenService } from '../../../../../application/services/AuthTokenService.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly tokenService: AuthTokenService,
    private readonly changePasswordUseCase?: ChangePasswordUseCase,
    private readonly forgotPasswordUseCase?: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase?: ResetPasswordUseCase
  ) {}

  changePassword = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.changePasswordUseCase) throw new Error('Not configured');
      const tokens = await this.changePasswordUseCase.execute(req.body, req.userId!);
      res.json({ data: { tokens }, message: 'Password changed', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.forgotPasswordUseCase) throw new Error('Not configured');
      await this.forgotPasswordUseCase.execute(req.body.email);
      res.json({
        data: null,
        message: 'If that email is registered, a reset link has been sent',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!this.resetPasswordUseCase) throw new Error('Not configured');
      await this.resetPasswordUseCase.execute(req.body.token, req.body.newPassword);
      res.json({ data: null, message: 'Password has been reset', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  register = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.registerUseCase.execute(req.body);
      res.status(201).json({
        data: result,
        message: 'Registration successful',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.loginUseCase.execute(req.body);
      res.json({
        data: result,
        message: 'Login successful',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        res.status(400).json({
          message: 'Refresh token is required',
          status: 400,
        });
        return;
      }

      let tokens;
      try {
        tokens = this.tokenService.refreshTokens(refreshToken);
      } catch {
        res.status(401).json({
          message: 'Invalid or expired refresh token',
          status: 401,
        });
        return;
      }
      res.json({
        data: tokens,
        message: 'Tokens refreshed',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}
