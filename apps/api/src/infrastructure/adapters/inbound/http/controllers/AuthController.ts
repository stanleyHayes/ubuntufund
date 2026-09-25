import type { Request, Response, NextFunction } from 'express';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import type { RegisterUserUseCase } from '../../../../../application/use-cases/RegisterUserUseCase.js';
import type { LoginUserUseCase } from '../../../../../application/use-cases/LoginUserUseCase.js';
import type { ChangePasswordUseCase } from '../../../../../application/use-cases/ChangePasswordUseCase.js';
import type {
  ForgotPasswordUseCase,
  ResetPasswordUseCase,
} from '../../../../../application/use-cases/ForgotPasswordUseCase.js';
import type { AuthTokenService } from '../../../../../application/services/AuthTokenService.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { SessionRevocationPort } from '../../../../../domain/ports/outbound/SessionRevocationPort.js';

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly tokenService: AuthTokenService,
    private readonly changePasswordUseCase?: ChangePasswordUseCase,
    private readonly forgotPasswordUseCase?: ForgotPasswordUseCase,
    private readonly resetPasswordUseCase?: ResetPasswordUseCase,
    private readonly userRepo?: UserRepositoryPort,
    private readonly sessions?: SessionRevocationPort
  ) {}

  /**
   * Server-side sign-out of the session the refresh token belongs to. Always
   * answers 200 so it reveals nothing about the token; clients clear local
   * storage regardless. Other devices stay signed in.
   */
  logout = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const session = typeof req.body?.refreshToken === 'string' ? this.tokenService.refreshTokenSessionId(req.body.refreshToken) : null;
      if (session && this.sessions) await this.sessions.revoke(session.sessionId, session.userId);
      res.json({ data: null, message: 'Signed out', status: 200 });
    } catch (error) {
      next(error);
    }
  };

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
        message: 'If that email is registered, you will receive a reset link shortly',
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
      const result = await this.registerUseCase.execute(req.body, { ip: req.ip, userAgent: req.get('user-agent') });
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
      const result = await this.loginUseCase.execute(req.body, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
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
        const payload = this.tokenService.verifyRefreshToken(refreshToken);
        const user = this.userRepo ? await this.userRepo.findById(payload.userId) : null;
        if (this.userRepo && !user) {
          res.status(401).json({ message: 'Account is no longer available', status: 401 });
          return;
        }
        if (user && (payload.authVersion ?? '') !== user.authVersion) throw new Error('Session has ended');
        if (payload.sessionId && this.sessions && await this.sessions.isRevoked(payload.sessionId)) throw new Error('Session was signed out');
        tokens = this.tokenService.generateTokens({ userId: payload.userId, role: user?.role ?? payload.role, authVersion: user?.authVersion ?? payload.authVersion, sessionId: payload.sessionId });
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
