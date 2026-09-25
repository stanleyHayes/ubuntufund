import { Router } from 'express';
import { DEFAULT_ROLES } from '@ubuntu-fund/types';
import type { createAuthMiddleware, AuthenticatedRequest } from '../../middleware/authMiddleware.js';

export function createRbacRoutes(
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  // Staff-console permissions. Only administrator accounts hold staff
  // permissions; member and organization accounts get none, so the console
  // never opens pages to them (the API still enforces every route).
  router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
    const role = req.userRole === 'admin'
      ? DEFAULT_ROLES.find((candidate) => candidate.slug === 'admin')
      : undefined;
    res.json({
      data: {
        roleName: role?.name ?? '',
        permissions: role?.permissions ?? [],
        userId: req.userId,
      },
      message: 'Permissions retrieved',
      status: 200,
    });
  });

  return router;
}
