import { Router, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { SaveCreatorProfileUseCase } from '../../../../../application/use-cases/SaveCreatorProfileUseCase.js';
import type { GetCreatorByHandleUseCase } from '../../../../../application/use-cases/GetCreatorByHandleUseCase.js';
import type { CreateTipIntentUseCase } from '../../../../../application/use-cases/CreateTipIntentUseCase.js';
import type { RequestCreatorWithdrawalUseCase } from '../../../../../application/use-cases/RequestCreatorWithdrawalUseCase.js';
import type { CreatorProfileRepositoryPort } from '../../../../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { CreatorBalanceRepositoryPort } from '../../../../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import type { CreatorPayoutRepositoryPort } from '../../../../../domain/ports/outbound/CreatorPayoutRepositoryPort.js';

/**
 * Creator tip-jar routes (buy-me-a-coffee). Public: view a creator page + tip
 * them. Authed: claim/update your own page + read your balance. The tip charge
 * settles via the Paystack webhook (`tip-` reference).
 */
export function createCreatorRoutes(deps: {
  saveProfile: SaveCreatorProfileUseCase;
  getByHandle: GetCreatorByHandleUseCase;
  createTip: CreateTipIntentUseCase;
  requestWithdrawal: RequestCreatorWithdrawalUseCase;
  profileRepo: CreatorProfileRepositoryPort;
  balanceRepo: CreatorBalanceRepositoryPort;
  payoutRepo: CreatorPayoutRepositoryPort;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}): Router {
  const router = Router();

  // --- Authed: manage your own creator page ---
  router.post(
    '/profile',
    deps.authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const profile = await deps.saveProfile.execute(req.userId!, req.body);
        res.json({ data: profile, message: 'Creator page saved', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/me',
    deps.authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const profile = await deps.profileRepo.findByUserId(req.userId!);
        const balance = await deps.balanceRepo.findByUserId(req.userId!);
        res.json({
          data: { profile: profile ? profile.toPlain() : null, balance },
          message: 'Creator dashboard',
          status: 200,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/withdraw',
    deps.authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await deps.requestWithdrawal.execute(req.userId!, req.body);
        res.status(201).json({ data: result, message: 'Withdrawal started', status: 201 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/me/payouts',
    deps.authMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const payouts = await deps.payoutRepo.findByCreator(req.userId!, 50);
        res.json({ data: payouts.map((p) => p.toPlain()), message: 'Withdrawals', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  // --- Public: view + tip a creator ---
  router.get(
    '/:handle',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const creator = await deps.getByHandle.execute(req.params.handle as string);
        res.json({ data: creator, message: 'Creator', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:handle/tips',
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await deps.createTip.execute(req.params.handle as string, {
          ...req.body,
          supporterUserId: req.userId,
        });
        res.status(201).json({ data: result, message: 'Tip checkout created', status: 201 });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
