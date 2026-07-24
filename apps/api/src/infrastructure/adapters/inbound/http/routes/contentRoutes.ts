import { Router } from 'express';
import { z } from 'zod';
import type { SiteContentController } from '../controllers/SiteContentController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

// PUT body: `data` (arbitrary JSON, required) and an optional `type` tag. `data`
// is accepted as any JSON value (object, array, string, …) but must be present.
const upsertContentSchema = z
  .object({
    type: z.string().min(1).max(120).optional(),
    data: z.unknown(),
  })
  .refine((body) => body.data !== undefined && body.data !== null, {
    message: 'A data payload is required',
    path: ['data'],
  });

/**
 * Headless-CMS content routes mounted at `/content`.
 *   GET  /content        — public, lists every block
 *   GET  /content/:key    — public, single block (404 when unknown)
 *   PUT  /content/:key    — admin-only (authMiddleware + requireAdmin)
 *
 * The public GETs are intentionally unauthenticated: the marketing site reads
 * these at runtime.
 */
export function createContentRoutes(
  controller: SiteContentController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: ReturnType<typeof requireRole>
): Router {
  const router = Router();

  router.get('/', controller.list);
  router.get('/:key', controller.getByKey);

  router.put(
    '/:key',
    authMiddleware,
    requireAdmin,
    validate(upsertContentSchema),
    controller.upsert
  );

  return router;
}
