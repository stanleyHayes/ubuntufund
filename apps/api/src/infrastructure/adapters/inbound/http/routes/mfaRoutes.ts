import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { MongoMfa } from '../../../outbound/persistence/MongoMfa.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';
const password = z.string().min(1).max(128);
const code = z.string().trim().min(6).max(64);
export function createMfaRoutes(mfa: MongoMfa, auth: RequestHandler): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.use(auth);
  const handler = (work: (req: AuthenticatedRequest) => Promise<unknown>): RequestHandler => async (req, res, next) => {
    try { res.json({ data: await work(req as AuthenticatedRequest) }); }
    catch (error) {
      // Wrong reauthentication input is recoverable within the current session.
      next(error instanceof AppError && error.statusCode === 401 ? new AppError(error.message, 400, error.errors) : error);
    }
  };
  router.get('/', handler(req => mfa.status(req.userId!)));
  router.post('/setup', authRateLimiter, validate(z.object({ password })), handler(req => mfa.begin(req.userId!, req.body.password)));
  router.post('/enable', authRateLimiter, validate(z.object({ password, code, enrollmentId: z.string().uuid() })), handler(req => mfa.enable(req.userId!, req.body.password, req.body.enrollmentId, req.body.code)));
  for (const action of ['disable', 'recovery-codes'] as const) {
    router.post(`/${action}`, authRateLimiter, validate(z.object({ password, code })), handler(req => mfa.change(req.userId!, req.body.password, req.body.code, action === 'disable')));
  }
  return router;
}
