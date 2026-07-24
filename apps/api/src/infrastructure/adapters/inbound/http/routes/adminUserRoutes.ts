import { Router, type RequestHandler } from 'express';
import type { AdminUserController } from '../controllers/AdminUserController.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

/**
 * Mounted at /users.
 *
 * GET / — admin-only, paginated user listing (?page&pageSize) surfacing
 * role/verificationLevel/trustScore for the admin dashboard.
 */
export function createAdminUserRoutes(
  controller: AdminUserController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler
): Router {
  const router = Router();

  router.get('/', authMiddleware, requireAdmin, controller.list);

  return router;
}
