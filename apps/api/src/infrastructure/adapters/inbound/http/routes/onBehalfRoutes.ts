import { Router, type NextFunction, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { BENEFICIARY_RELATIONSHIPS } from '@ubuntu-fund/types';
import type { AuthenticatedRequest, createAuthMiddleware, createOptionalAuthMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import { clientIp } from '../../middleware/clientIp.js';
import { beneficiaryInvitationRateLimiter, beneficiaryManageRateLimiter } from '../../middleware/rateLimiter.js';
import type { MongoOnBehalfCampaigns } from '../../../outbound/persistence/MongoOnBehalfCampaigns.js';

// Tokens travel in the body, never the path, so they stay out of access logs.
const tokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid invitation link') }).strict();
const declineSchema = z.object({ token: tokenSchema.shape.token, reason: z.string().trim().max(500).optional() }).strict();
const beneficiarySchema = z.object({
  beneficiaryType: z.enum(['individual', 'organization']),
  beneficiaryName: z.string().trim().min(2).max(120),
  beneficiaryEmail: z.string().trim().email().max(254),
  relationship: z.enum(BENEFICIARY_RELATIONSHIPS),
  reason: z.string().trim().min(10).max(1000),
  payoutArrangement: z.enum(['beneficiary', 'organization']),
}).strict();
const staffReason = z.string().trim().min(20, 'Explain the decision in at least 20 characters').max(2000);
const reassignSchema = beneficiarySchema.extend({ staffReason }).strict();
const authoritySchema = z.object({ target: z.enum(['beneficiary', 'organization', 'none']), staffReason }).strict();

const meta = (req: AuthenticatedRequest) => ({ ip: clientIp(req), userAgent: req.header('user-agent') ?? undefined });

/**
 * Campaigns run on someone else's behalf:
 *  - public invitation links (preview, decline; accept needs sign-in),
 *  - the organizer's and beneficiary's controls,
 *  - staff overrides (reassign, payout authority), each with a written reason.
 * Every mutation is authorized on the server; the UI only mirrors it.
 */
export function createOnBehalfRoutes(deps: {
  service: MongoOnBehalfCampaigns;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
  optionalAuthMiddleware: ReturnType<typeof createOptionalAuthMiddleware>;
  requireAdmin: RequestHandler;
}): { invitations: Router; campaigns: Router; beneficiary: Router; admin: Router } {
  const wrap = (handler: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => { handler(req, res).catch(next); };

  const invitations = Router();
  invitations.post('/preview', beneficiaryInvitationRateLimiter, validate(tokenSchema), wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.preview(req.body.token), status: 200 });
  }));
  invitations.post('/accept', beneficiaryInvitationRateLimiter, deps.authMiddleware, validate(tokenSchema), wrap(async (req, res) => {
    const result = await deps.service.accept(req.body.token, { userId: req.userId!, authVersion: req.authVersion }, meta(req));
    res.json({ data: result, message: 'You accepted this campaign.', status: 200 });
  }));
  // Declining needs no account: whoever received the invitation can refuse it.
  invitations.post('/decline', beneficiaryInvitationRateLimiter, deps.optionalAuthMiddleware, validate(declineSchema), wrap(async (req, res) => {
    await deps.service.decline(req.body.token, meta(req), req.userId, req.body.reason);
    res.json({ data: null, message: 'You declined this campaign.', status: 200 });
  }));

  const campaigns = Router();
  campaigns.get('/:id/beneficiary', deps.authMiddleware, wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.details(String(req.params.id), { userId: req.userId, isAdmin: req.userRole === 'admin' }), status: 200 });
  }));
  campaigns.post('/:id/beneficiary/invitation', deps.authMiddleware, beneficiaryManageRateLimiter, wrap(async (req, res) => {
    res.json({ data: await deps.service.resend(String(req.params.id), req.userId!), message: 'Invitation sent again.', status: 200 });
  }));
  campaigns.put('/:id/beneficiary', deps.authMiddleware, beneficiaryManageRateLimiter, validate(beneficiarySchema), wrap(async (req, res) => {
    await deps.service.changeBeneficiary(String(req.params.id), req.userId!, req.body);
    res.json({ data: null, message: 'Beneficiary updated and invited.', status: 200 });
  }));
  campaigns.post('/:id/beneficiary/consent/revoke', deps.authMiddleware, beneficiaryManageRateLimiter, wrap(async (req, res) => {
    await deps.service.revokeConsent(String(req.params.id), req.userId!, meta(req));
    res.json({ data: null, message: 'Consent withdrawn.', status: 200 });
  }));

  const beneficiary = Router();
  beneficiary.get('/campaigns', deps.authMiddleware, wrap(async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json({ data: await deps.service.listForBeneficiary(req.userId!), status: 200 });
  }));

  const admin = Router();
  admin.post('/:id/beneficiary/reassign', deps.authMiddleware, deps.requireAdmin, validate(reassignSchema), wrap(async (req, res) => {
    const { staffReason: reason, ...input } = req.body;
    await deps.service.reassign(String(req.params.id), req.userId!, input, reason);
    res.json({ data: null, message: 'Beneficiary reassigned and invited.', status: 200 });
  }));
  admin.put('/:id/payout-authority', deps.authMiddleware, deps.requireAdmin, validate(authoritySchema), wrap(async (req, res) => {
    await deps.service.setPayoutAuthority(String(req.params.id), req.userId!, req.body.target, req.body.staffReason);
    res.json({ data: null, message: 'Payout authority updated.', status: 200 });
  }));

  return { invitations, campaigns, beneficiary, admin };
}
