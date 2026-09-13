import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { requiresContentAcceptance } from './contentAcceptance.js';
import type { Request, Response, NextFunction } from 'express';
import type { AuthTokenService } from '../../../../application/services/AuthTokenService.js';
import { AppError } from './errorHandler.js';
import type { UserRepositoryPort } from '../../../../domain/ports/outbound/UserRepositoryPort.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userRole?: string;
  authVersion?: string;
}

/**
 * Populates req.userId/userRole when a valid Bearer token is present, but
 * permits guests. Authenticated publishing restrictions and repository failures
 * remain enforceable rather than silently downgrading a known account to a guest.
 */
export function createOptionalAuthMiddleware(tokenService: AuthTokenService, userRepo?: UserRepositoryPort) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) { next(); return; }
    let payload: ReturnType<AuthTokenService['verifyAccessToken']>;
    try { payload = tokenService.verifyAccessToken(authHeader.substring(7)); }
    catch { next(); return; }
    try {
      const user = userRepo ? await userRepo.findById(payload.userId) : null;
      if (userRepo && !user) { next(); return; }
      if (user && (payload.authVersion ?? '') !== user.authVersion) { next(); return; }
      if (user && requiresContentAcceptance(req.method, req.originalUrl, req.body) && await ContentRestrictionModel.exists({ userId: user.id })) {
        next(new AppError('Publishing is restricted following a moderation review. Remove the public message to continue donating, or contact support@ujimora.com to appeal.', 403)); return;
      }
      req.userId = payload.userId;
      req.userRole = user?.role ?? payload.role;
      next();
    } catch (error) { next(error); }

  };
}

export function createAuthMiddleware(tokenService: AuthTokenService, userRepo?: UserRepositoryPort) {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required', 401));
    }

    const token = authHeader.substring(7);

    try {
      const payload = tokenService.verifyAccessToken(token);
      let currentRole = payload.role;
      if (userRepo) {
        const user = await userRepo.findById(payload.userId);
        if (!user) return next(new AppError('Account is no longer available', 401));
        if ((payload.authVersion ?? '') !== user.authVersion) return next(new AppError('Your session has ended. Please sign in again.', 401));
        currentRole = user.role;
        if (requiresContentAcceptance(req.method, req.originalUrl, req.body) && await ContentRestrictionModel.exists({ userId: user.id })) {
          return next(new AppError('Publishing is restricted following a moderation review. Contact support@ujimora.com to appeal. Your account settings and funds remain accessible.', 403));
        }
        if (user.role !== 'admin' && requiresContentAcceptance(req.method, req.originalUrl, req.body) && !hasCurrentLegalAcceptance(user.legalAcceptance)) {
          return next(new AppError('Review the current account agreement and confirm you are at least 18 before publishing or uploading content', 428));
        }
      }
      req.userId = payload.userId;
      req.userRole = currentRole;
      req.authVersion = payload.authVersion ?? '';
      next();
    } catch {
      next(new AppError('Invalid or expired token', 401));
    }
  };
}
