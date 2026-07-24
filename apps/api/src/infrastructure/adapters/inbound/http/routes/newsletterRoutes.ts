import { Router } from 'express';
import { z } from 'zod';
import type { NewsletterController } from '../controllers/NewsletterController.js';
import { validate } from '../../middleware/validate.js';
import { newsletterRateLimiter } from '../../middleware/rateLimiter.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

const subscribeNewsletterSchema = z.object({
  email: z.string().email(),
});

// The public POST /subscribe is an unauthenticated write, so it carries a
// dedicated rate limiter (mirroring how credential endpoints use
// authRateLimiter) on top of the global API limit. GET /subscribers is the
// admin-only counterpart, guarded by authMiddleware + requireAdmin.
export function createNewsletterRoutes(
  controller: NewsletterController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: ReturnType<typeof requireRole>
): Router {
  const router = Router();

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
