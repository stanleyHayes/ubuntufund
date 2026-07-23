import type { Request, Response, NextFunction } from 'express';
import type { RegisterUserUseCase } from '../../../../../application/use-cases/RegisterUserUseCase.js';
import type { LoginUserUseCase } from '../../../../../application/use-cases/LoginUserUseCase.js';
import type { AuthTokenService } from '../../../../../application/services/AuthTokenService.js';

export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly tokenService: AuthTokenService
  ) {}

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

      const tokens = this.tokenService.refreshTokens(refreshToken);
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
