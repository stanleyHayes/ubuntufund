import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { queuePageSize } from '../../middleware/queuePageSize.js';
import { validate } from '../../middleware/validate.js';
import {
  REFUND_REQUEST_TRANSITIONS,
  type RefundRecord,
  type RefundRepositoryPort,
  type RefundStatus,
} from '../../../../../domain/ports/outbound/RefundRepositoryPort.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { JournalEntryModel } from '../../../../database/models/JournalEntryModel.js';
import { DonationIntentModel } from '../../../../database/models/DonationIntentModel.js';
import { RefundOperationModel } from '../../../../database/models/RefundOperationModel.js';

const STATUSES = ['pending', 'processing', 'completed', 'failed'] as const;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** Only a contribution that actually shows a provider refund can close a request as completed. */
const REFUNDED_INTENT_STATUSES = ['REFUNDED', 'PARTIALLY_REFUNDED'];

const updateSchema = z.object({
  status: z.enum(['processing', 'completed', 'failed']),
  staffNote: z.string().trim().min(20).max(2000),
  refundOperationId: z.string().trim().min(1).max(100).optional(),
}).strict();

type Contribution = { id: string; status: string; provider: string; providerRef?: string; currency: string; refundedAmountMinor?: number };

/** Settled donations link to their payment through the settlement journal entry. */
async function contributionsFor(donationIds: string[]): Promise<Map<string, Contribution>> {
  const entries = await JournalEntryModel.find({ donationId: { $in: donationIds }, donationIntentId: { $exists: true } })
    .select('donationId donationIntentId').lean();
  const intentIds = entries.map((entry) => entry.donationIntentId).filter((id): id is string => !!id && OBJECT_ID.test(id));
  const intents = await DonationIntentModel.find({ _id: { $in: intentIds } })
    .select('_id status provider providerRef currency refundedAmountMinor').lean();
  const byIntent = new Map(intents.map((intent) => [String(intent._id), intent]));
  const result = new Map<string, Contribution>();
  for (const entry of entries) {
    const intent = entry.donationIntentId ? byIntent.get(entry.donationIntentId) : undefined;
    if (!entry.donationId || !intent) continue;
    result.set(entry.donationId, {
      id: String(intent._id), status: intent.status, provider: intent.provider, providerRef: intent.providerRef,
      currency: intent.currency, refundedAmountMinor: intent.refundedAmountMinor,
    });
  }
  return result;
}

async function toAdminView(items: RefundRecord[]) {
  const ids = (values: string[]) => [...new Set(values.filter((value) => OBJECT_ID.test(value)))];
  const [campaigns, users, contributions] = await Promise.all([
    CampaignModel.find({ _id: { $in: ids(items.map((item) => item.campaignId)) } }).select('_id title').lean(),
    UserModel.find({ _id: { $in: ids(items.map((item) => item.requesterId)) } }).select('_id name email').lean(),
    contributionsFor(items.map((item) => item.donationId)),
  ]);
  const titles = new Map(campaigns.map((campaign) => [String(campaign._id), campaign.title]));
  const people = new Map(users.map((user) => [String(user._id), { name: user.name, email: user.email }]));
  return items.map((item) => ({
    ...item,
    campaignTitle: titles.get(item.campaignId) ?? 'Unavailable campaign',
    requesterName: people.get(item.requesterId)?.name ?? 'Former account',
    requesterEmail: people.get(item.requesterId)?.email,
    contribution: contributions.get(item.donationId) ?? null,
  }));
}

/**
 * Staff queue for donor refund requests (POST /refunds). A request is intake
 * only; money moves through POST /admin/payments/:id/refund. Status changes are
 * forward-only, noted, audit-logged and conditional on the prior status.
 */
export function createAdminRefundRequestRoutes(auth: RequestHandler, admin: RequestHandler, refunds: RefundRepositoryPort) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/', async (req, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const status = req.query.status;
      if (status !== undefined && !STATUSES.includes(status as RefundStatus)) {
        throw new AppError('Status must be pending, processing, completed or failed', 400);
      }
      const { items, total } = await refunds.list({ status: status as RefundStatus | undefined, page, pageSize });
      res.json({ data: { items: await toAdminView(items), total, page, pageSize } });
    } catch (error) { next(error); }
  });

  router.patch('/:id', validate(updateSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      if (!OBJECT_ID.test(id)) throw new AppError('Refund request not found', 404);
      const input = updateSchema.parse(req.body);
      const current = await refunds.findById(id);
      if (!current) throw new AppError('Refund request not found', 404);
      if (!REFUND_REQUEST_TRANSITIONS[current.status].includes(input.status)) {
        throw new AppError(`A ${current.status} refund request cannot be marked ${input.status}`, 409);
      }
      const contribution = (await contributionsFor([current.donationId])).get(current.donationId);
      if (input.status === 'completed' && !REFUNDED_INTENT_STATUSES.includes(contribution?.status ?? '')) {
        // The donor is told their refund is complete; require the payment to show it.
        throw new AppError('Refund the contribution first. A request can be completed only after its payment shows a refund.', 409);
      }
      if (input.refundOperationId) {
        const operation = contribution && await RefundOperationModel.exists({ _id: input.refundOperationId, intentId: contribution.id });
        if (!operation) throw new AppError('That refund operation does not belong to this donation', 400);
      }
      const updated = await refunds.updateStatus(id, {
        status: input.status, staffNote: input.staffNote, actorId: req.userId!, refundOperationId: input.refundOperationId,
      });
      if (!updated) throw new AppError('This refund request changed. Refresh and try again.', 409);
      res.json({ data: (await toAdminView([updated]))[0] });
    } catch (error) { next(error); }
  });

  return router;
}
