import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
import { ContentRestrictionModel } from '../../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { UserBlockRepositoryPort } from '../../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { donationIntentRateLimiter } from '../../middleware/rateLimiter.js';
import type { VerifyCreatorTipUseCase } from '../../../../../application/use-cases/VerifyCreatorTipUseCase.js';
import type { PlanLimitsService } from '../../../../../application/services/PlanLimitsService.js';
import { Router, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest, createAuthMiddleware, createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';
import type { SaveCreatorProfileUseCase } from '../../../../../application/use-cases/SaveCreatorProfileUseCase.js';
import type { GetCreatorByHandleUseCase } from '../../../../../application/use-cases/GetCreatorByHandleUseCase.js';
import { TIP_MAX_AMOUNT, type CreateTipIntentUseCase } from '../../../../../application/use-cases/CreateTipIntentUseCase.js';
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
  verifyTip: VerifyCreatorTipUseCase;
  planLimits: PlanLimitsService;
  saveProfile: SaveCreatorProfileUseCase;
  getByHandle: GetCreatorByHandleUseCase;
  createTip: CreateTipIntentUseCase;
  requestWithdrawal: RequestCreatorWithdrawalUseCase;
  profileRepo: CreatorProfileRepositoryPort;
  balanceRepo: CreatorBalanceRepositoryPort;
  payoutRepo: CreatorPayoutRepositoryPort;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  optionalAuth: ReturnType<typeof createOptionalAuthMiddleware>;
  blocks: UserBlockRepositoryPort;
}): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  // --- Authed: manage your own creator page ---
  router.post(
    '/profile',
    deps.authMiddleware,
    validate(z.object({
      handle: z.string().trim().min(3).max(31).optional(), displayName: z.string().trim().min(2).max(100).optional(),
      tagline: z.string().max(200).optional(), bio: z.string().max(5000).optional(),
      avatarUrl: z.union([z.string().url().max(2000).refine(url => /^https?:\/\//i.test(url)), z.literal('')]).optional(),
      coverUrl: z.union([z.string().url().max(2000).refine(url => /^https?:\/\//i.test(url)), z.literal('')]).optional(),
      tipsEnabled: z.boolean().optional(), presetAmounts: z.array(z.number().finite().positive().multipleOf(0.01).max(TIP_MAX_AMOUNT)).max(6).optional(),
      currency: z.literal('GHS').optional(), thankYouMessage: z.string().max(1000).optional(), automatedReviewConsent: z.boolean().optional(),
    }).strict()),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const profile = await deps.saveProfile.execute(req.userId!, req.body, req.authVersion ?? '');
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
          data: { profile: profile ? profile.toPlain() : null, balance, policy: await deps.planLimits.creatorPolicy(req.userId!) },
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
        const result = await deps.requestWithdrawal.execute(req.userId!, req.body, req.authVersion ?? '');
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

  router.post('/tips/verify', donationIntentRateLimiter, validate(z.object({ reference: z.string().regex(/^tip-[a-zA-Z0-9-]{8,100}$/) })), async (req, res, next) => {
    try { res.json({ data: await deps.verifyTip.execute(req.body.reference) }); } catch (error) { next(error); }
  });

  // --- Public: view + tip a creator ---
  router.get(
    '/:handle',
    deps.optionalAuth,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const creator = await deps.getByHandle.execute(req.params.handle as string, req.userId);
        if (await ContentRestrictionModel.exists({ userId: creator.userId })) throw new AppError('Creator not found', 404);
        res.set('Cache-Control', 'private, no-store').json({ data: creator, message: 'Creator', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/:handle/tips',
    deps.optionalAuth,
    donationIntentRateLimiter,
    validate(z.object({ legalAcceptance: legalAcceptanceSchema.optional(), amount: z.number().finite().positive().multipleOf(0.01).max(TIP_MAX_AMOUNT), supporterEmail: z.string().trim().email().max(254), supporterName: z.string().trim().max(100).optional(), message: z.string().trim().max(1000).optional(), isAnonymous: z.boolean().optional() })),
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const profile = await deps.profileRepo.findByHandle(req.params.handle as string);
        if (profile && req.userId && await deps.blocks.isBlocked(req.userId, profile.userId)) throw new AppError('Creator not found', 404);
        if (profile && await ContentRestrictionModel.exists({ userId: profile.userId })) throw new AppError('Creator not found', 404);
        const result = await deps.createTip.execute(req.params.handle as string, {
          ...req.body,
          supporterUserId: req.userId,
          idempotencyKey: req.get('Idempotency-Key'),
        });
        res.status(201).json({ data: result, message: 'Tip checkout created', status: 201 });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
