import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { queuePageSize } from '../../middleware/queuePageSize.js';
import { validate } from '../../middleware/validate.js';
import { ActivityAlertDeliveryModel } from '../../../../database/models/ActivityAlertDeliveryModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';

const resolveSchema = z.object({
  // 'delivered': staff confirmed the message in the email provider's log.
  // 'suppress': give up on it. There is no re-send: the provider's
  // idempotency key has expired, so a re-send could deliver a duplicate.
  action: z.enum(['delivered', 'suppress']),
  note: z.string().trim().min(20).max(2000),
}).strict();

/**
 * Activity emails whose delivery became ambiguous for ~23 hours are parked in
 * 'review' by the delivery worker. Staff check the provider log using the
 * idempotency key shown here, then record the outcome. Email bodies and
 * addresses are never returned.
 */
export function createAdminActivityDeliveryRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  router.get('/', async (req, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
      const filter = { status: 'review', channel: 'email' };
      const [rows, total] = await Promise.all([
        ActivityAlertDeliveryModel.find(filter).sort({ firstAttemptAt: 1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize)
          .select('_id userId category title firstAttemptAt attempts lastError occurredAt updatedAt').lean(),
        ActivityAlertDeliveryModel.countDocuments(filter),
      ]);
      res.json({ data: { total, page, pageSize, items: rows.map(row => ({
        id: String(row._id), userId: row.userId, category: row.category, title: row.title,
        idempotencyKey: `activity/${row._id}`, firstAttemptAt: row.firstAttemptAt, attempts: row.attempts,
        lastError: row.lastError, occurredAt: row.occurredAt, updatedAt: row.updatedAt,
      })) } });
    } catch (error) { next(error); }
  });

  router.patch('/:id', validate(resolveSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = resolveSchema.parse(req.body);
      const id = String(req.params.id);
      await new MongoUnitOfWork().run(async () => {
        const update = input.action === 'delivered'
          ? { $set: { status: 'delivered', deliveredAt: new Date(), lastError: 'confirmed_by_staff' }, $unset: { emailRequest: 1 } }
          : { $set: { status: 'suppressed', lastError: 'suppressed_by_staff' }, $unset: { emailRequest: 1 } };
        // Conditional on 'review' so two staff cannot both resolve the same row.
        const row = await ActivityAlertDeliveryModel.findOneAndUpdate({ _id: id, status: 'review', channel: 'email' }, update, { new: true });
        if (!row) throw new AppError('This email is no longer waiting for a delivery check. Refresh the list.', 409);
        await AuditLogModel.create({
          actorId: req.userId, actorRole: 'admin', action: `activity_email.${input.action}`, resource: `activity-delivery:${id}`,
          details: `Activity email (${row.category}) ${input.action === 'delivered' ? 'confirmed delivered' : 'suppressed'} after delivery review`,
          reason: input.note, method: 'PATCH', path: '/admin/activity-deliveries/:id', statusCode: 200,
        });
      });
      res.json({ data: { resolved: true } });
    } catch (error) { next(error); }
  });

  return router;
}
