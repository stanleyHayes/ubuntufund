import { Router } from 'express';
import { DEFAULT_ROLES } from '@ubuntu-fund/types';
import type { createAuthMiddleware, AuthenticatedRequest } from '../../middleware/authMiddleware.js';

export function createRbacRoutes(
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
    const role = DEFAULT_ROLES.find((candidate) => candidate.slug === req.userRole);
    res.json({
      data: {
        roleName: role?.name ?? 'User',
        permissions: role?.permissions ?? [],
        userId: req.userId,
      },
      message: 'Permissions retrieved',
      status: 200,
    });
  });

  return router;
}
