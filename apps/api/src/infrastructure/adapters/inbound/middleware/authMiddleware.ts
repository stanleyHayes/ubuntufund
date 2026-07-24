import type { Request, Response, NextFunction } from 'express';
import type { AuthTokenService } from '../../../../application/services/AuthTokenService.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Populates req.userId/userRole when a valid Bearer token is present, but
 * never rejects — for public routes whose responses differ for owners.
 */
export function createOptionalAuthMiddleware(tokenService: AuthTokenService) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = tokenService.verifyAccessToken(authHeader.substring(7));
        req.userId = payload.userId;
        req.userRole = payload.role;
      } catch {
        // Invalid token on an optional-auth route: treat as anonymous.
      }
    }
    next();
  };
}

export function createAuthMiddleware(tokenService: AuthTokenService) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.substring(7);

    try {
      const payload = tokenService.verifyAccessToken(token);
      req.userId = payload.userId;
      req.userRole = payload.role;
      next();
    } catch {
      throw new AppError('Invalid or expired token', 401);
    }
  };
}
