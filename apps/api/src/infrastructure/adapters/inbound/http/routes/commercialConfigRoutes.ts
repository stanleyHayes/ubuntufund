import { Router, type Response, type NextFunction, type RequestHandler } from 'express';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  AFFILIATE_REFERRAL_DISCOUNT_KEY,
  CAMPAIGN_AUTO_APPROVE_TIER_KEY,
  CAMPAIGN_TIER_THRESHOLD_KEYS,
  REVIEW_ALERT_EMAIL_KEY,
  type CommercialConfigService,
} from '../../../../../application/services/CommercialConfigService.js';

/**
 * Admin-only commercial config (ADR-5): view the effective values + env
 * defaults, set an effective-dated override, and read a key's change history.
 * The versioned store IS the audit trail (who / when / why / value).
 */
export function createCommercialConfigRoutes(deps: {
  service: CommercialConfigService;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  requireAdmin: RequestHandler;
}): Router {
  const router = Router();

  router.get(
    '/',
    deps.authMiddleware,
    deps.requireAdmin,
    async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const [resolved, referralDiscountPercent, campaigns, reviewAlertEmail] =
          await Promise.all([
            deps.service.resolvePayoutsConfig(),
            deps.service.resolveReferralDiscountPercent(),
            deps.service.resolveCampaignsConfig(),
            deps.service.resolveReviewAlertEmail(''),
          ]);
        res.json({
          data: {
            resolved: {
              ...resolved,
              [AFFILIATE_REFERRAL_DISCOUNT_KEY]: referralDiscountPercent,
              [CAMPAIGN_AUTO_APPROVE_TIER_KEY]: campaigns.autoApproveMaxTier,
              ...Object.fromEntries(
                CAMPAIGN_TIER_THRESHOLD_KEYS.map((k, i) => [k, campaigns.tierThresholds[i]])
              ),
              [REVIEW_ALERT_EMAIL_KEY]: reviewAlertEmail,
            },
            defaults: deps.service.getDefaults(),
            keys: deps.service.allKeys,
          },
          message: 'Commercial config',
          status: 200,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    '/:key/history',
    deps.authMiddleware,
    deps.requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const history = await deps.service.history(req.params.key as string);
        res.json({ data: history, message: 'Config history', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/:key',
    deps.authMiddleware,
    deps.requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const key = req.params.key as string;
        if (!deps.service.isKnownKey(key)) {
          throw new AppError('Unknown commercial-config key.', 400);
        }
        const { value, effectiveFrom, reason } = req.body ?? {};

        // Text settings take a different shape and a different validator.
        if (deps.service.isTextKey(key)) {
          if (typeof value !== 'string') {
            throw new AppError('value must be a string.', 400);
          }
          const text = value.trim();
          // Empty is how alerts are switched off, so it must be allowed — but
          // anything non-empty has to be a real address or the alert silently
          // fails to send and nobody learns that campaigns are piling up.
          if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
            throw new AppError('value must be a valid email address.', 400);
          }
          const at = effectiveFrom ? new Date(effectiveFrom) : new Date();
          if (Number.isNaN(at.getTime())) {
            throw new AppError('effectiveFrom is not a valid date.', 400);
          }
          const saved = await deps.service.setTextValue(key, text, req.userId!, at, reason);
          res.json({ data: saved, message: 'Commercial config updated', status: 200 });
          return;
        }

        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          throw new AppError('value must be a non-negative number.', 400);
        }
        if ((key.endsWith('Percent') || key === 'earlyMaxWithdrawalPercent') && value > 100) throw new AppError('Percentage cannot exceed 100.', 400);
        const eff = effectiveFrom ? new Date(effectiveFrom) : new Date();
        if (Number.isNaN(eff.getTime())) {
          throw new AppError('effectiveFrom is not a valid date.', 400);
        }
        const version = await deps.service.setValue(key, value, req.userId!, eff, reason);
        res.json({ data: version, message: 'Commercial config updated', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
