import { Router } from 'express';
import { z } from 'zod';
import type { CampaignUpdateController } from '../controllers/CampaignUpdateController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

const campaignUpdateTypeSchema = z.enum([
  'milestone',
  'general',
  'thank_you',
  'urgent',
]);

const createCampaignUpdateSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string().min(1).max(5000),
  type: campaignUpdateTypeSchema,
  mediaUrls: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
});

const updateCampaignUpdateSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
  type: campaignUpdateTypeSchema.optional(),
  mediaUrls: z.array(z.string()).optional(),
});

/**
 * Mounts nested update routes under the same base path as campaignRoutes
 * (e.g. /campaigns). This router is designed to be mounted alongside
 * createCampaignRoutes at the '/campaigns' prefix — Express supports
 * multiple routers sharing a mount prefix.
 */
export function createCampaignUpdateRoutes(
  controller: CampaignUpdateController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/:id/updates', controller.list);
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
