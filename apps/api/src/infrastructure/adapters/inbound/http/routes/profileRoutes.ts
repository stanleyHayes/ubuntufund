import { Router } from 'express';
import { z } from 'zod';
import type { ProfileController } from '../controllers/ProfileController.js';
import { validate } from '../../middleware/validate.js';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';

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

const updateProfileSchema = z.object({
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

export function createProfileRoutes(
  controller: ProfileController,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.get('/', authMiddleware, controller.getMyProfile);
  router.put(
    '/',
    authMiddleware,
    validate(updateProfileSchema),
    controller.updateMyProfile
  );

  return router;
}
