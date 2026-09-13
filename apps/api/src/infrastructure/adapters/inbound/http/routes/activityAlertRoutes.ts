import { Router } from 'express';
import { z } from 'zod';
import { ACTIVITY_ALERT_CATEGORIES, defaultActivityAlertPreferences } from '@ubuntu-fund/types';
import { ActivityAlertPreferenceModel } from '../../../../database/models/ActivityAlertPreferenceModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import type { createAuthMiddleware, AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';

export function createActivityAlertRoutes(auth: ReturnType<typeof createAuthMiddleware>, emailConfigured: boolean) {
  const router = Router();
  router.use(auth);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const [saved, user] = await Promise.all([ActivityAlertPreferenceModel.findOne({ userId: req.userId }), UserModel.findById(req.userId).select('emailVerified')]);
      const preferences = defaultActivityAlertPreferences();
      for (const category of ACTIVITY_ALERT_CATEGORIES) for (const channel of ['inApp', 'email'] as const) preferences[category][channel] = saved?.choices.get(`${category}_${channel}`)?.enabled === true;
      res.json({ data: { preferences, emailVerified: user?.emailVerified === true, emailConfigured } });
    } catch (error) { next(error); }
  });
  router.put('/', validate(z.object({ category: z.enum(ACTIVITY_ALERT_CATEGORIES), channel: z.enum(['inApp', 'email']), enabled: z.boolean() }).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      const { category, channel, enabled } = req.body;
      const key = `${category}_${channel}`;
      await new MongoUnitOfWork().run(async () => {
        const user = await UserModel.findOne({ _id: req.userId, deletedAt: null }).select('emailVerified');
        if (!user) throw new AppError('Account not found.', 404);
        if (enabled && channel === 'email' && !user.emailVerified) throw new AppError('Verify your email address before enabling activity emails.', 409);
        const saved = await ActivityAlertPreferenceModel.findOneAndUpdate({ userId: req.userId }, { $setOnInsert: { userId: req.userId } }, { upsert: true, new: true });
        const previous = saved.choices.get(key);
        if (previous?.enabled !== enabled) {
          const now = new Date();
          saved.choices.set(key, { enabled, changedAt: now, ...(enabled ? { enabledAt: now } : {}) });
          await saved.save();
        }
      });
      res.json({ data: { category, channel, enabled } });
    } catch (error) { next(error); }
  });
  return router;
}
