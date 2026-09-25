import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { SiteContentController } from '../controllers/SiteContentController.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

// PUT body: `data` (arbitrary JSON, required) and an optional `type` tag. `data`
// is accepted as any JSON value (object, array, string, …) but must be present.
const upsertContentSchema = z
  .object({
    type: z.string().min(1).max(120).optional(),
    data: z.unknown(),
    // The `updatedAt` the editor loaded; enables the stale-edit (409) check.
    expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((body) => body.data !== undefined && body.data !== null, {
    message: 'A data payload is required',
    path: ['data'],
  });

// Shapes of the blocks the marketing site renders. A payload of the wrong
// shape (e.g. `{}` for marketing.stats) used to be stored and then crashed the
// public page that maps over it. Objects pass through extra fields so records
// saved by older editors still round-trip; unknown keys stay free-form.
const text = (max: number) => z.string().max(max);
const optionalText = (max: number) => z.string().max(max).optional();
const richBlock = z.object({ eyebrow: text(120), title: text(300), body: text(5000) }).passthrough();
const KNOWN_CONTENT_SHAPES: Record<string, z.ZodTypeAny> = {
  'marketing.stats': z.object({
    items: z.array(z.object({ value: text(60), label: text(120) }).passthrough()).max(12),
  }).passthrough(),
  faq: z.object({
    items: z.array(z.object({ category: text(80), question: text(300), answer: text(4000) }).passthrough()).max(200),
  }).passthrough(),
  about: z.object({
    hero: z.object({ title: text(300), subtitle: text(1000) }).passthrough(),
    mission: richBlock,
    vision: richBlock,
    philosophy: z.object({ eyebrow: text(120), quote: text(300), body: text(5000) }).passthrough(),
    team: z.array(z.object({
      name: text(120), role: text(200), initials: text(8), bio: text(3000),
      image: optionalText(2000), website: optionalText(2000), companyUrl: optionalText(2000),
      socials: z.array(z.object({ label: text(60), href: text(2000) }).passthrough()).max(12).optional(),
    }).passthrough()).max(20),
  }).passthrough(),
  contact: z.object({
    email: optionalText(254), phone: optionalText(60), address: optionalText(500), hours: optionalText(300),
    socials: z.object({
      facebook: optionalText(500), x: optionalText(500), instagram: optionalText(500), linkedin: optionalText(500), youtube: optionalText(500),
    }).passthrough().optional(),
    responseTimes: z.array(z.object({ label: text(120), time: text(120) }).passthrough()).max(12).optional(),
  }).passthrough(),
};

/** Reject a known block whose payload the marketing site could not render. */
function validateKnownShape(req: Request, _res: Response, next: NextFunction): void {
  const shape = KNOWN_CONTENT_SHAPES[String(req.params.key)];
  if (!shape) return next();
  const result = shape.safeParse(req.body?.data);
  if (result.success) return next();
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = ['data', ...issue.path].join('.');
    (errors[path] ??= []).push(issue.message);
  }
  next(new AppError(`The ${String(req.params.key)} content does not have the expected shape.`, 400, errors));
}

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
    validateKnownShape,
    controller.upsert
  );

  return router;
}
