import { Router } from 'express';
import type { NotificationController } from '../controllers/NotificationController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

export function createNotificationRoutes(
  controller: NotificationController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', authMiddleware, controller.getMine);
  router.get('/unread-count', authMiddleware, controller.getUnreadCount);
  router.put('/read-all', authMiddleware, controller.markAllAsRead);
  router.put('/:id/read', authMiddleware, controller.markAsRead);

  return router;
}
