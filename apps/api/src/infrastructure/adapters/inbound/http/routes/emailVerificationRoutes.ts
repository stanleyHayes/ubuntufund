import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AccountEmails } from '../../../outbound/AccountEmails.js';
import type { UserRepositoryPort } from '../../../../../domain/ports/outbound/UserRepositoryPort.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { EmailVerificationTokenModel } from '../../../../database/models/EmailVerificationTokenModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';
import type { createAuthMiddleware, AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function createEmailVerificationRoutes(auth: ReturnType<typeof createAuthMiddleware>, users: UserRepositoryPort, emails: AccountEmails) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', auth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await users.findById(req.userId!);
      if (!user) throw new AppError('Account not found', 404);
      res.json({ data: { emailVerified: user.emailVerified, deliveryConfigured: emails.configured } });
    } catch (error) { next(error); }
  });
  router.post('/', auth, authRateLimiter, validate(z.object({}).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await users.findById(req.userId!);
      if (!user) throw new AppError('Account not found', 404);
      if (!user.emailVerified) {
        if (!emails.configured) throw new AppError('Verification email is temporarily unavailable. Please try again later.', 503);
        await emails.enqueue(user, 'verification');
      }
      res.json({ data: { emailVerified: user.emailVerified }, message: user.emailVerified ? 'Your email is already verified.' : 'Check your email for a verification link. Allow a minute before requesting another.' });
    } catch (error) { next(error); }
  });
  router.post('/confirm', authRateLimiter, validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) }).strict()), async (req, res, next) => {
    try {
      await new MongoUnitOfWork().run(async () => {
        const token = await EmailVerificationTokenModel.findOne({ tokenHash: digest(req.body.token), usedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
        const user = token ? await UserModel.findOne({ _id: token.userId, deletedAt: null }) : null;
        if (!token || !user || digest(user.email) !== token.emailHash || (user.authVersion ?? '') !== token.authVersion) throw new AppError('This verification link is invalid, expired or already used. Request a new link in Settings.', 400);
        await UserModel.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
        token.usedAt = new Date();
        await token.save();
      });
      res.json({ data: { emailVerified: true }, message: 'Email verified. Your notification choices have not changed.' });
    } catch (error) { next(error); }
  });
  return router;
}
