import { queuePageSize } from '../../middleware/queuePageSize.js';
import { Router } from 'express';
import { z } from 'zod';
import type { createAuthMiddleware, AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { StoreBillingRuntime } from '../../../../config/storeBilling.js';
import { StorePurchaseModel } from '../../../../database/models/StorePurchaseModel.js';
import { StoreBillingNotificationModel } from '../../../../database/models/StoreBillingNotificationModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';

export const storePurchaseIssues = { $or: [{ reviewRequired: true }, { acknowledgementPending: true }, { lastError: { $exists: true } }] };

/** Operators can inspect sanitized failures and queue retries, never edit receipt ownership or grant access. */
export function createStoreBillingAdminRoutes(auth: ReturnType<typeof createAuthMiddleware>, runtime: StoreBillingRuntime | null) {
  const router = Router();
  router.use(auth, requireAdmin);
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const skip = (page - 1) * pageSize;
      const [purchases, notifications, purchaseTotal, notificationTotal] = await Promise.all([
        StorePurchaseModel.find(storePurchaseIssues).select('_id userId store productId basePlanId active periodEnd acknowledgementPending reviewRequired lastError nextCheckAt lastCheckedAt').sort({ nextCheckAt: 1 }).skip(skip).limit(pageSize).lean(),
        StoreBillingNotificationModel.find().select('_id store attempts reviewRequired lastError nextAttemptAt leaseUntil updatedAt').sort({ nextAttemptAt: 1 }).skip(skip).limit(pageSize).lean(),
        StorePurchaseModel.countDocuments(storePurchaseIssues), StoreBillingNotificationModel.countDocuments(),
      ]);
      res.json({ data: { enabled: !!runtime, purchases, notifications, purchaseTotal, notificationTotal, page, pageSize } });
    } catch (error) { next(error); }
  });
  router.post('/:kind/:id/retry', validate(z.object({ reason: z.string().trim().min(10).max(1000) }).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!runtime) throw new AppError('Store billing must be configured before retrying verification.', 503);
      const id = String(req.params.id);
      const kind = String(req.params.kind);
      if (!/^[a-f0-9]{64}$/.test(id) || !['purchase', 'notification'].includes(kind)) throw new AppError('Invalid billing work item.', 400);
      await new MongoUnitOfWork().run(async () => {
        const result = kind === 'purchase'
          ? await StorePurchaseModel.updateOne({ _id: id, replacedBy: { $exists: false }, ...storePurchaseIssues }, { $set: { nextCheckAt: new Date() } })
          : await StoreBillingNotificationModel.updateOne({ _id: id }, { $set: { nextAttemptAt: new Date() } });
        if (!result.matchedCount) throw new AppError('No pending billing work found.', 404);
        // Audit and scheduling commit together. A retry does not clear review flags or an active lease.
        await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: 'STORE_BILLING_RETRY', resource: 'subscriptions',
          details: `Queued ${kind} ${id} for authoritative store verification`, reason: req.body.reason, method: 'POST', path: req.originalUrl, statusCode: 202 });
      });
      res.status(202).json({ data: { queued: true } });
    } catch (error) { next(error); }
  });
  return router;
}
