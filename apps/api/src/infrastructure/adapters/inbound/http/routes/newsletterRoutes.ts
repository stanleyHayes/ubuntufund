import { Router } from 'express';
import { z } from 'zod';
import type { NewsletterController } from '../controllers/NewsletterController.js';
import { validate } from '../../middleware/validate.js';
import { newsletterRateLimiter } from '../../middleware/rateLimiter.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import type { NewsletterConsentService } from '../../../../../application/services/NewsletterConsentService.js';
import { AppError } from '../../middleware/errorHandler.js';

const subscribeNewsletterSchema = z.object({
  email: z.string().trim().email(),
  consent: z.literal(true),
}).strict();

// The public POST /subscribe is an unauthenticated write, so it carries a
// dedicated rate limiter (mirroring how credential endpoints use
// authRateLimiter) on top of the global API limit. GET /subscribers is the
// admin-only counterpart, guarded by authMiddleware + requireAdmin.
export function createNewsletterRoutes(
  controller: NewsletterController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: ReturnType<typeof requireRole>,
  consent: NewsletterConsentService,
  users: UserRepositoryPort
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) }).strict();
  for (const action of ['confirm', 'unsubscribe'] as const) router.post(`/${action}`, newsletterRateLimiter, validate(tokenSchema), async (req, res, next) => {
    try { await consent[action](req.body.token); res.json({ data: { subscribed: action === 'confirm' } }); } catch (error) { next(error); }
  });
  router.get('/preference', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await users.findById(req.userId!); if (!user) throw new AppError('Account not found', 404);
      res.json({ data: await consent.preference(user.email.value) });
    } catch (error) { next(error); }
  });
  router.put('/preference', authMiddleware, newsletterRateLimiter, validate(z.object({ enabled: z.boolean() }).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await users.findById(req.userId!); if (!user) throw new AppError('Account not found', 404);
      if (req.body.enabled) await consent.request(user.email.value, 'settings'); else await consent.withdrawByEmail(user.email.value);
      res.json({ data: await consent.preference(user.email.value) });
    } catch (error) { next(error); }
  });

  router.post(
    '/subscribe',
    newsletterRateLimiter,
    validate(subscribeNewsletterSchema),
    controller.subscribe
  );

  // Registered after the public POST /subscribe so the literal '/subscribe'
  // and '/subscribers' segments never collide.
  router.get(
    '/subscribers',
    authMiddleware,
    requireAdmin,
    controller.listSubscribers
  );

  return router;
}
