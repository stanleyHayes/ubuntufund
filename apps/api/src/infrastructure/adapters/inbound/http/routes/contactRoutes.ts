import { Router } from 'express';
import { z } from 'zod';
import type { ContactController } from '../controllers/ContactController.js';
import { validate } from '../../middleware/validate.js';
import { contactRateLimiter } from '../../middleware/rateLimiter.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { requireRole } from '../../middleware/requireRole.js';

export function createContactRoutes(controller: ContactController, authMiddleware: ReturnType<typeof createAuthMiddleware>, requireAdmin: ReturnType<typeof requireRole>): Router {
  const router = Router();
  router.post('/', contactRateLimiter, validate(z.object({
    name: z.string().trim().min(2).max(120), email: z.string().email().max(254),
    subject: z.string().trim().min(2).max(200), inquiryType: z.enum(['general', 'partnership', 'campaign', 'bug']),
    message: z.string().trim().min(10).max(5000),
  })), controller.submit);
  router.get('/', authMiddleware, requireAdmin, controller.list);
  router.get('/stats', authMiddleware, requireAdmin, controller.stats);
  router.patch('/:id/status', authMiddleware, requireAdmin, validate(z.object({
    status: z.enum(['new', 'in_progress', 'resolved', 'archived']), adminNotes: z.string().trim().max(5000).optional(),
  })), controller.updateStatus);
  return router;
}
