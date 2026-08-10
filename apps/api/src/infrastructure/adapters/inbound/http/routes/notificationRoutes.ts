import { Router } from 'express';
import type { NotificationController } from '../controllers/NotificationController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';

export function createNotificationRoutes(
  controller: NotificationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', authMiddleware, controller.getMine);
  router.get('/unread-count', authMiddleware, controller.getUnreadCount);
  router.put('/read-all', authMiddleware, controller.markAllAsRead);
  router.post('/push/register', authMiddleware, validate(z.object({
    token: z.string().min(16).max(4096),
    platform: z.enum(['ios', 'android', 'web']),
  })), controller.registerPushToken);
  router.delete('/push/unregister', authMiddleware, validate(z.object({
    token: z.string().min(16).max(4096),
  })), controller.unregisterPushToken);
  router.put('/:id/read', authMiddleware, controller.markAsRead);

  return router;
}
