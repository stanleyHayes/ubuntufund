import { logger } from '../../../../logging/logger.js';
import { Router } from 'express';
import type { UserBlockRepositoryPort } from '../../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
export function createUserSafetyRoutes(blocks: UserBlockRepositoryPort, users: UserRepositoryPort, auth: ReturnType<typeof createAuthMiddleware>, enforceBlock?: (first: string, second: string) => Promise<void>) {
  const router = Router();
  router.use(auth);
  router.get('/blocks', async (req: AuthenticatedRequest, res, next) => {
    try {
      const ids = await blocks.list(req.userId!);
      const items = await Promise.all(ids.map(async id => ({ id, name: (await users.findById(id))?.name ?? 'Former member' })));
      res.set('Cache-Control', 'no-store').json({ data: { items } });
    } catch (error) { next(error); }
  });
  router.put('/blocks/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      if (!/^[a-f0-9]{24}$/i.test(id) || id === req.userId) throw new AppError('Choose another user to block', 400);
      if (!await users.findById(id)) throw new AppError('User not found', 404);
      await blocks.block(req.userId!, id);
      let providerCleanupPending = false;
      try { await enforceBlock?.(req.userId!, id); }
      catch (error) { providerCleanupPending = true; logger.error({ err: error }, 'Block saved; live connection cleanup queued'); }
      res.set('Cache-Control', 'no-store').json({ data: { providerCleanupPending }, message: providerCleanupPending ? 'User blocked. Live connection cleanup will retry.' : 'User blocked' });
    } catch (error) { next(error); }
  });
  router.delete('/blocks/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      await blocks.unblock(req.userId!, String(req.params.id));
      res.set('Cache-Control', 'no-store').json({ data: null, message: 'User unblocked' });
    } catch (error) { next(error); }
  });
  return router;
}
