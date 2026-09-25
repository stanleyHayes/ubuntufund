import { UserModel } from '../../../../database/models/UserModel.js';
import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
import { Router } from 'express';
import { LEGAL_ACCEPTANCE_VERSION, hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { z } from 'zod';
import { platformMediaUrl } from './urlSchemas.js';
import type { ProfileController } from '../controllers/ProfileController.js';
import { validate } from '../../middleware/validate.js';
import { clientIp } from '../../middleware/clientIp.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import { MongoLegalAcceptanceLog } from '../../../outbound/persistence/MongoLegalAcceptanceLog.js';

const legalLog = new MongoLegalAcceptanceLog();

const notificationPreferencesSchema = z
  .object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    push: z.boolean().optional(),
    donationReceipts: z.boolean().optional(),
    campaignUpdates: z.boolean().optional(),
    marketingEmails: z.boolean().optional(),
  })
  .partial();

// '' clears the image; anything else must come from POST /uploads/image.
const imageUrlSchema = z.union([z.literal(''), platformMediaUrl]).optional();

const updateProfileSchema = z.object({
  automatedReviewConsent: z.boolean().optional(),
  avatarUrl: imageUrlSchema,
  coverUrl: imageUrlSchema,
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(30).optional(),
  bio: z.string().max(1000).optional(),
  country: z.string().min(2).max(100).optional(),
  notificationPreferences: notificationPreferencesSchema.optional(),
  preferredCurrency: z.string().min(2).max(5).optional(),
  language: z.string().max(50).optional(),
  darkMode: z.boolean().optional(),
  anonymousDonations: z.boolean().optional(),
  showLeaderboards: z.boolean().optional(),
  publicProfile: z.boolean().optional(),
});

// Both optional so a missing password reaches the use case, which explains how
// to finish deletion (older app builds send no body).
const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128).optional(),
  code: z.string().trim().min(6).max(64).optional(),
});

export function createProfileRoutes(
  controller: ProfileController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/', authMiddleware, controller.getMyProfile);
  router.get('/website-request', authMiddleware, async (req, res, next) => {
    try {
      const userId = (req as import('../../middleware/authMiddleware.js').AuthenticatedRequest).userId!;
      const user = await UserModel.findOne({ _id: userId, role: 'organization', deletedAt: { $exists: false } }).select('needsWebsite websiteRequestedAt websiteRequestWithdrawnAt').lean();
      if (!user) { res.status(404).json({ message: 'Organization account not found' }); return; }
      res.set('Cache-Control', 'private, no-store').json({ data: { needsWebsite: !!user.needsWebsite, requestedAt: user.websiteRequestedAt ?? null, withdrawnAt: user.websiteRequestWithdrawnAt ?? null } });
    } catch (error) { next(error); }
  });
  router.post('/website-request/withdraw', authMiddleware, async (req, res, next) => {
    try {
      const userId = (req as import('../../middleware/authMiddleware.js').AuthenticatedRequest).userId!;
      // Only transition an active request: repeated withdrawals preserve the original timestamp.
      await UserModel.updateOne({ _id: userId, role: 'organization', needsWebsite: true, deletedAt: { $exists: false } }, { $set: { needsWebsite: false, websiteRequestWithdrawnAt: new Date() } });
      const user = await UserModel.findOne({ _id: userId, role: 'organization', deletedAt: { $exists: false } }).select('needsWebsite websiteRequestWithdrawnAt').lean();
      if (!user) { res.status(404).json({ message: 'Organization account not found' }); return; }
      res.set('Cache-Control', 'private, no-store').json({ data: { needsWebsite: false, withdrawnAt: user.websiteRequestWithdrawnAt ?? null } });
    } catch (error) { next(error); }
  });
  // Server-side truth for the agreement notice. Clients bundle their own copy of
  // LEGAL_ACCEPTANCE_VERSION, which lags the API until they update, so they ask
  // here on start, on focus and after any 428 instead of trusting the cache.
  router.get('/legal-acceptance', authMiddleware, async (req, res, next) => {
    try {
      const userId = (req as import('../../middleware/authMiddleware.js').AuthenticatedRequest).userId!;
      const user = await UserModel.findOne({ _id: userId, deletedAt: null }).select('legalAcceptance').lean();
      if (!user) { res.status(404).json({ message: 'Account not found' }); return; }
      res.set('Cache-Control', 'no-store').json({ data: {
        current: hasCurrentLegalAcceptance(user.legalAcceptance),
        requiredVersion: LEGAL_ACCEPTANCE_VERSION,
        record: user.legalAcceptance ?? null,
      }, status: 200 });
    } catch (error) { next(error); }
  });
  router.post('/legal-acceptance', authMiddleware, validate(legalAcceptanceSchema), async (req, res, next) => {
    try {
      const userId = (req as import('../../middleware/authMiddleware.js').AuthenticatedRequest).userId!;
      const { version, acceptedTerms, ageConfirmed } = req.body as { version: string; acceptedTerms: boolean; ageConfirmed: boolean };
      await new MongoUnitOfWork().run(async () => {
        const acceptedAt = new Date();
        // Idempotent for the same version: a retry must not rewrite the acceptance time.
        const result = await UserModel.updateOne({ _id: userId, deletedAt: { $exists: false }, $or: [
          { 'legalAcceptance.version': { $ne: version } },
          { 'legalAcceptance.acceptedTerms': { $ne: true } },
          { 'legalAcceptance.ageConfirmed': { $ne: true } },
        ] }, {
          $set: { legalAcceptance: { version, acceptedTerms, ageConfirmed, acceptedAt } },
        });
        // Append history only for a real change, in the same transaction, so a
        // retried or repeated request cannot add a duplicate event.
        if (result.modifiedCount === 1) {
          await legalLog.record({ userId, version, acceptedTerms, ageConfirmed, acceptedAt, source: 'reaccept', ip: clientIp(req), userAgent: req.get('user-agent') });
        }
      });
      const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
      if (!user) { res.status(404).json({ message: 'Account not found' }); return; }
      res.set('Cache-Control', 'no-store').json({ data: user.legalAcceptance, status: 200 });
    } catch (error) { next(error); }
  });
  router.put(
    '/',
    authMiddleware,
    validate(updateProfileSchema),
    controller.updateMyProfile
  );
  router.get('/closure-check', authMiddleware, controller.getClosureCheck);
  router.delete('/', authMiddleware, authRateLimiter, validate(deleteAccountSchema), controller.deleteMyAccount);

  return router;
}
