import { UserModel } from '../../../../database/models/UserModel.js';
import { legalAcceptanceSchema } from './legalAcceptanceSchema.js';
import { Router } from 'express';
import { z } from 'zod';
import type { ProfileController } from '../controllers/ProfileController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';

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

const imageUrlSchema = z.union([z.literal(''), z.string().url().max(2048).refine((value) => value.startsWith('https://'), 'Use an HTTPS image URL')]).optional();

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
  router.post('/legal-acceptance', authMiddleware, validate(legalAcceptanceSchema), async (req, res, next) => {
    try {
      const userId = (req as import('../../middleware/authMiddleware.js').AuthenticatedRequest).userId!;
      // Idempotent for the same version: a retry must not rewrite the acceptance time.
      await UserModel.updateOne({ _id: userId, deletedAt: { $exists: false }, $or: [
        { 'legalAcceptance.version': { $ne: req.body.version } },
        { 'legalAcceptance.acceptedTerms': { $ne: true } },
        { 'legalAcceptance.ageConfirmed': { $ne: true } },
      ] }, {
        $set: { legalAcceptance: { ...req.body, acceptedAt: new Date() } },
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
