import { Router } from 'express';
import { z } from 'zod';
import type { LiveSessionController } from '../controllers/LiveSessionController.js';
import type { RealtimeController } from '../controllers/RealtimeController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const startLiveSessionSchema = z.object({
  title: z.string().max(200).optional(),
  targetAmount: z.number().positive().optional(),
  showDonorNames: z.boolean().optional(),
  showDonorMessages: z.boolean().optional(),
  showAmounts: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
});

const updateLiveSessionSchema = z.object({
  status: z.literal('ended').optional(),
  showDonorNames: z.boolean().optional(),
  showDonorMessages: z.boolean().optional(),
  showAmounts: z.boolean().optional(),
  privacyMode: z.boolean().optional(),
});

/**
 * Live-session routes that extend the /campaigns resource (mounted alongside
 * the other campaign sub-routers in app.ts):
 *   POST /campaigns/:id/live-sessions  → start a session (owner/admin)
 *   GET  /campaigns/:id/events         → PUBLIC campaign SSE feed
 */
export function createCampaignLiveSessionRoutes(
  liveSessionController: LiveSessionController,
  realtimeController: RealtimeController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/:id/live-sessions',
    authMiddleware,
    validate(startLiveSessionSchema),
    liveSessionController.start
  );
  router.get('/:id/events', realtimeController.campaignEvents);

  return router;
}

/**
 * The /live-sessions resource:
 *   PATCH /live-sessions/:id                     → end / update privacy (owner)
 *   POST  /live-sessions/:id/overlay-token/rotate → rotate overlay token (owner)
 *   GET   /live-sessions/:id/public              → PUBLIC donor sheet
 *   GET   /live-sessions/:id/overlay?token=…     → token-gated overlay payload
 *   GET   /live-sessions/:id/events?token=…      → token-gated SSE feed
 */
export function createLiveSessionRoutes(
  liveSessionController: LiveSessionController,
  realtimeController: RealtimeController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/:id/public', liveSessionController.getPublic);
  router.get('/:id/overlay', liveSessionController.getOverlay);
  router.get('/:id/events', realtimeController.liveSessionEvents);
  router.post(
    '/:id/overlay-token/rotate',
    authMiddleware,
    liveSessionController.rotateToken
  );
  router.patch(
    '/:id',
    authMiddleware,
    validate(updateLiveSessionSchema),
    liveSessionController.update
  );

  return router;
}
