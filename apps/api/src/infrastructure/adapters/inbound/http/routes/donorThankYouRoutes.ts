import { Router, type NextFunction, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { DONOR_THANK_YOU_LIMITS } from '@ubuntu-fund/types';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { donorMessageUnsubscribeRateLimiter, donorThankYouRateLimiter } from '../../middleware/rateLimiter.js';
import type { MongoDonorThankYous } from '../../../outbound/persistence/MongoDonorThankYous.js';

const contentSchema = z.object({
  subject: z.string().max(DONOR_THANK_YOU_LIMITS.subject + 20),
  body: z.string().max(DONOR_THANK_YOU_LIMITS.body + 200),
  signature: z.string().max(DONOR_THANK_YOU_LIMITS.signature + 20).default(''),
}).strict();
const sendSchema = z.object({ automatedReviewConsent: z.boolean().optional() }).strict();
const preferenceSchema = z.object({ thankYouEmails: z.boolean() }).strict();

/**
 * Donor thank-you messages. Campaign routes need the organizer, one of its
 * organization's admins/editors, or the campaign's consenting beneficiary;
 * anyone else gets 404, so the endpoints do not reveal which campaigns exist.
 */
export function createDonorThankYouRoutes(deps: {
  service: MongoDonorThankYous;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  requireAdmin: RequestHandler;
}): { campaigns: Router; donorMessages: Router; profile: Router; admin: Router } {
  const wrap = (handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
  const actor = (req: AuthenticatedRequest) => ({ userId: req.userId!, authVersion: req.authVersion });

  const campaigns = Router();
  campaigns.get('/:id/thank-you', deps.authMiddleware, wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.state(String(req.params.id), actor(req)), status: 200 });
  }));
  campaigns.put('/:id/thank-you/draft', deps.authMiddleware, donorThankYouRateLimiter, validate(contentSchema), wrap(async (req, res) => {
    res.json({ data: await deps.service.saveDraft(String(req.params.id), actor(req), req.body), message: 'Draft saved', status: 200 });
  }));
  campaigns.delete('/:id/thank-you/draft', deps.authMiddleware, donorThankYouRateLimiter, wrap(async (req, res) => {
    await deps.service.discardDraft(String(req.params.id), actor(req));
    res.json({ data: null, message: 'Draft discarded', status: 200 });
  }));
  campaigns.post('/:id/thank-you/preview', deps.authMiddleware, donorThankYouRateLimiter, validate(contentSchema), wrap(async (req, res) => {
    res.json({ data: await deps.service.preview(String(req.params.id), actor(req), req.body), status: 200 });
  }));
  campaigns.post('/:id/thank-you/send', deps.authMiddleware, donorThankYouRateLimiter, validate(sendSchema), wrap(async (req, res) => {
    const { view, replayed } = await deps.service.submit(String(req.params.id), actor(req), req.body, req.header('Idempotency-Key'));
    res.status(replayed ? 200 : 202).json({ data: view, message: replayed ? 'Already sent' : 'Your message is being delivered', status: replayed ? 200 : 202 });
  }));
  campaigns.get('/:id/thank-you/:thankYouId', deps.authMiddleware, wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.summary(String(req.params.id), String(req.params.thankYouId), actor(req)), status: 200 });
  }));
  campaigns.post('/:id/thank-you/:thankYouId/retry', deps.authMiddleware, donorThankYouRateLimiter, wrap(async (req, res) => {
    res.json({ data: await deps.service.retry(String(req.params.id), String(req.params.thankYouId), actor(req)), message: 'Retrying failed deliveries', status: 200 });
  }));

  // One-click unsubscribe (RFC 8058): mail clients POST to the List-Unsubscribe
  // URL with the token in the query; the web page posts it in the body.
  const donorMessages = Router();
  donorMessages.post('/unsubscribe', donorMessageUnsubscribeRateLimiter, wrap(async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token : typeof req.query.token === 'string' ? req.query.token : '';
    await deps.service.unsubscribe(token);
    res.json({ data: null, message: 'You will not receive thank-you messages from campaigns at this address.', status: 200 });
  }));

  const profile = Router();
  profile.get('/donor-messages', deps.authMiddleware, wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.preferences(req.userId!), status: 200 });
  }));
  profile.put('/donor-messages', deps.authMiddleware, validate(preferenceSchema), wrap(async (req, res) => {
    res.json({ data: await deps.service.setPreferences(req.userId!, req.body.thankYouEmails), status: 200 });
  }));

  const admin = Router();
  admin.get('/', deps.authMiddleware, deps.requireAdmin, wrap(async (req, res) => {
    const page = Number(req.query.page) || 1, pageSize = Number(req.query.pageSize) || 25;
    res.json({ data: await deps.service.adminList({ status: typeof req.query.status === 'string' ? req.query.status : undefined, page, pageSize }), status: 200 });
  }));
  admin.post('/:id/retry', deps.authMiddleware, deps.requireAdmin, wrap(async (req, res) => {
    res.json({ data: await deps.service.adminRetry(String(req.params.id), req.userId!), message: 'Retrying failed deliveries', status: 200 });
  }));

  return { campaigns, donorMessages, profile, admin };
}
