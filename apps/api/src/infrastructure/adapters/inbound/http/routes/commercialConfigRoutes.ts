import { Router, type Response, type NextFunction, type RequestHandler } from 'express';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { UnitOfWorkPort } from '../../../../../domain/ports/outbound/UnitOfWorkPort.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import {
  AFFILIATE_REFERRAL_DISCOUNT_KEY,
  CAMPAIGN_AUTO_APPROVE_TIER_KEY,
  CAMPAIGN_TIER_THRESHOLD_KEYS,
  REVIEW_ALERT_EMAIL_KEY,
  type CommercialConfigService,
} from '../../../../../application/services/CommercialConfigService.js';

type ValidatedChange =
  | { key: string; kind: 'text'; value: string }
  | { key: string; kind: 'number'; value: number };

/** One validator for single and batch writes, so both enforce the same rules. */
function validateChange(service: CommercialConfigService, key: string, value: unknown): ValidatedChange {
  if (!service.isKnownKey(key)) {
    throw new AppError('Unknown commercial-config key.', 400);
  }
  // Text settings take a different shape and a different validator.
  if (service.isTextKey(key)) {
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
    return { key, kind: 'text', value: text };
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AppError('value must be a non-negative number.', 400);
  }
  if ((key.endsWith('Percent') || key === 'earlyMaxWithdrawalPercent') && value > 100) throw new AppError('Percentage cannot exceed 100.', 400);
  return { key, kind: 'number', value };
}

function effectiveDate(effectiveFrom: unknown): Date {
  const at = effectiveFrom ? new Date(effectiveFrom as string) : new Date();
  if (Number.isNaN(at.getTime())) {
    throw new AppError('effectiveFrom is not a valid date.', 400);
  }
  return at;
}

/**
 * Admin-only commercial config (ADR-5): view the effective values + env
 * defaults, set an effective-dated override, and read a key's change history.
 * The versioned store IS the audit trail (who / when / why / value).
 */
export function createCommercialConfigRoutes(deps: {
  service: CommercialConfigService;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  requireAdmin: RequestHandler;
  unitOfWork?: UnitOfWorkPort;
}): Router {
  const router = Router();
  const unitOfWork = deps.unitOfWork ?? new MongoUnitOfWork();

  /**
   * Several keys at once, all or nothing, with one shared effectiveFrom — so a
   * settings form never leaves a new tier live beside old thresholds.
   */
  router.put(
    '/',
    deps.authMiddleware,
    deps.requireAdmin,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const { changes, effectiveFrom, reason } = req.body ?? {};
        if (!Array.isArray(changes) || changes.length === 0 || changes.length > 25) {
          throw new AppError('changes must list between 1 and 25 settings.', 400);
        }
        if (reason !== undefined && (typeof reason !== 'string' || reason.length > 500)) {
          throw new AppError('reason must be text of at most 500 characters.', 400);
        }
        const validated = changes.map((change: unknown) => {
          const { key, value } = (change ?? {}) as { key?: unknown; value?: unknown };
          return validateChange(deps.service, String(key), value);
        });
        if (new Set(validated.map((change) => change.key)).size !== validated.length) {
          throw new AppError('Each setting may appear only once.', 400);
        }
        const at = effectiveDate(effectiveFrom);

        const thresholdChanges = validated.filter((change) =>
          (CAMPAIGN_TIER_THRESHOLD_KEYS as readonly string[]).includes(change.key));
        if (thresholdChanges.length) {
          // The merged boundaries must stay strictly ascending: the tier is how
          // many boundaries a goal exceeds, so disorder mis-tiers every campaign.
          const current = (await deps.service.resolveCampaignsConfig()).tierThresholds;
          const merged = CAMPAIGN_TIER_THRESHOLD_KEYS.map((key, i) =>
            (thresholdChanges.find((change) => change.key === key)?.value as number | undefined) ?? current[i]);
          if (merged.some((value, i) => !(value > 0) || (i > 0 && value <= merged[i - 1]))) {
            throw new AppError('Tier thresholds must be positive and strictly ascending.', 400);
          }
        }

        const saved = await unitOfWork.run(async () => {
          const versions = [];
          for (const change of validated) {
            versions.push(change.kind === 'text'
              ? await deps.service.setTextValue(change.key, change.value, req.userId!, at, reason)
              : await deps.service.setValue(change.key, change.value, req.userId!, at, reason));
          }
          return versions;
        });
        res.json({ data: saved, message: 'Commercial config updated', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

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
        const { value, effectiveFrom, reason } = req.body ?? {};
        const change = validateChange(deps.service, key, value);
        const at = effectiveDate(effectiveFrom);
        if (change.kind === 'text') {
          const saved = await deps.service.setTextValue(key, change.value, req.userId!, at, reason);
          res.json({ data: saved, message: 'Commercial config updated', status: 200 });
          return;
        }
        const version = await deps.service.setValue(key, change.value, req.userId!, at, reason);
        res.json({ data: version, message: 'Commercial config updated', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
