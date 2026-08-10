import { Router } from 'express';
import { z } from 'zod';
import type { TestimonialController } from '../controllers/TestimonialController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

const fields = {
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  quote: z.string().trim().min(1).max(1200),
  rating: z.number().int().min(1).max(5),
  avatarUrl: z.string().url().optional(),
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  displayOrder: z.number().int().min(0).optional(),
};

export function createTestimonialRoutes(
  controller: TestimonialController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: ReturnType<typeof requireRole>
): Router {
  const router = Router();
  router.get('/', controller.listPublished);
  router.get('/admin', authMiddleware, requireAdmin, controller.listAdmin);
  router.get('/stats', authMiddleware, requireAdmin, controller.stats);
  router.post('/', authMiddleware, requireAdmin, validate(z.object(fields)), controller.create);
  router.put('/:id', authMiddleware, requireAdmin, validate(z.object(fields).partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required')), controller.update);
  router.delete('/:id', authMiddleware, requireAdmin, controller.remove);
  return router;
}
