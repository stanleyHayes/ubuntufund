import { Router } from 'express';
import { z } from 'zod';
import type { CampaignUpdateController } from '../controllers/CampaignUpdateController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware, createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';

const campaignUpdateTypeSchema = z.enum([
  'milestone',
  'general',
  'thank_you',
  'urgent',
]);

const createCampaignUpdateSchema = z.object({
  automatedReviewConsent: z.boolean().optional(),
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(5000),
  type: campaignUpdateTypeSchema,
  mediaUrls: z.array(z.string().url().max(2000)).max(10).default([]),
  isPinned: z.boolean().default(false),
});

const updateCampaignUpdateSchema = z.object({
  automatedReviewConsent: z.boolean().optional(),
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  type: campaignUpdateTypeSchema.optional(),
  mediaUrls: z.array(z.string().url().max(2000)).max(10).optional(),
});

/**
 * Mounts nested update routes under the same base path as campaignRoutes
 * (e.g. /campaigns). This router is designed to be mounted alongside
 * createCampaignRoutes at the '/campaigns' prefix — Express supports
 * multiple routers sharing a mount prefix.
 */
export function createCampaignUpdateRoutes(
  controller: CampaignUpdateController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/:id/updates', optionalAuth, controller.list);
  router.post(
    '/:id/updates',
    authMiddleware,
    validate(createCampaignUpdateSchema),
    controller.create
  );
  router.put(
    '/:id/updates/:updateId',
    authMiddleware,
    validate(updateCampaignUpdateSchema),
    controller.update
  );
  router.delete('/:id/updates/:updateId', authMiddleware, controller.remove);
  router.post(
    '/:id/updates/:updateId/pin',
    authMiddleware,
    controller.pin
  );

  return router;
}
