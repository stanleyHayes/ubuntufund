import { queuePageSize } from '../../middleware/queuePageSize.js';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { requireAdmin } from '../../middleware/requireRole.js';
import { dataRightsRateLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../middleware/errorHandler.js';
import { DataRightsRequestModel, DataRightsEventModel } from '../../../../database/models/DataRightsRequestModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { MongoUnitOfWork } from '../../../outbound/persistence/MongoUnitOfWork.js';

const fields = '_id kind details status response revision dueAt respondedAt deliveryMethod createdAt updatedAt';
const pageOf = (value: unknown) => Math.max(1, Math.min(10000, Math.floor(Number(value)) || 1));

export function createDataRightsRoutes(auth: ReturnType<typeof createAuthMiddleware>) {
  const router = Router();
  router.use(auth, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      const page = pageOf(req.query.page), filter = { userId: req.userId! };
      const [items, total] = await Promise.all([
        DataRightsRequestModel.find(filter).select(fields).sort({ createdAt: -1 }).skip((page - 1) * 10).limit(10).lean(),
        DataRightsRequestModel.countDocuments(filter),
      ]);
      res.json({ data: { items, total, page, pageSize: 10 } });
    } catch (error) { next(error); }
  });
  router.post('/', dataRightsRateLimiter, validate(z.object({ kind: z.enum(['access', 'correction', 'complaint']), details: z.string().trim().min(10).max(5000) }).strict()), async (req: AuthenticatedRequest, res, next) => {
    try {
      req.body.details = req.body.details.trim();
      const item = await new MongoUnitOfWork().run(async () => {
        // Also fence a simultaneous account closure with a write to the active account.
        const user = await UserModel.findOneAndUpdate({ _id: req.userId, deletedAt: { $exists: false } }, { $set: { updatedAt: new Date() } });
        if (!user) throw new AppError('Account not found', 404);
        if (await DataRightsRequestModel.exists({ userId: req.userId, kind: req.body.kind, active: true })) throw new AppError('You already have an open request of this type. Follow its progress below or contact legal@ujimora.com.', 409);
        const record = await DataRightsRequestModel.create({ userId: req.userId, ...req.body, dueAt: new Date(Date.now() + 30 * 86400_000) });
        await DataRightsEventModel.create({ requestId: String(record._id), actorId: req.userId, action: 'submitted', revision: 0 });
        return DataRightsRequestModel.findById(record._id).select(fields).lean();
      });
      res.status(201).json({ data: item });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) { next(new AppError('You already have an open request of this type.', 409)); return; }
      next(error);
    }
  });
  return router;
}

export function createDataRightsAdminRoutes(auth: ReturnType<typeof createAuthMiddleware>) {
  const router = Router();
  router.use(auth, requireAdmin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const pageSize = queuePageSize(req.query.pageSize);
      const page = pageOf(req.query.page), filter = req.query.status === 'responded' ? { active: false } : { active: true };
      const [items, total] = await Promise.all([
        DataRightsRequestModel.find(filter).sort({ dueAt: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        DataRightsRequestModel.countDocuments(filter),
      ]);
      res.json({ data: { items, total, page, pageSize } });
    } catch (error) { next(error); }
  });
  router.get('/:id/events', async (req, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) throw new AppError('Invalid request ID', 400);
      const page = pageOf(req.query.page), filter = { requestId: String(req.params.id) };
      const [items, total] = await Promise.all([
        DataRightsEventModel.find(filter).sort({ revision: -1 }).skip((page - 1) * 25).limit(25).lean(),
        DataRightsEventModel.countDocuments(filter),
      ]);
      res.json({ data: { items, total, page, pageSize: 25 } });
    } catch (error) { next(error); }
  });
  router.put('/:id/review', dataRightsRateLimiter, validate(z.object({
    revision: z.number().int().nonnegative(), status: z.enum(['in_review', 'responded']),
    evidence: z.string().trim().min(20).max(5000), response: z.string().trim().max(100000).default(''),
    deliveryMethod: z.enum(['account', 'verified_external']).default('account'), deliveryReference: z.string().trim().max(1000).default(''),
  }).strict().refine(value => value.status !== 'responded' || value.response.length >= 20, { message: 'Provide a response for the requester', path: ['response'] }).refine(value => value.status !== 'responded' || value.deliveryMethod !== 'verified_external' || value.deliveryReference.length >= 20, { message: 'Record identity verification and completed delivery evidence', path: ['deliveryReference'] })), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) throw new AppError('Invalid request ID', 400);
      // The shared validator checks input but does not apply Zod defaults/transforms.
      req.body.deliveryMethod ??= 'account';
      req.body.response = (req.body.response ?? '').trim();
      req.body.evidence = req.body.evidence.trim();
      req.body.deliveryReference = (req.body.deliveryReference ?? '').trim();
      const item = await new MongoUnitOfWork().run(async () => {
        const staff = await UserModel.findOneAndUpdate({ _id: req.userId, role: 'admin', deletedAt: null,
          ...(req.authVersion ? { authVersion: req.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
        }, { $inc: { staffActionVersion: 1 } }, { new: true });
        if (!staff) throw new AppError('Current administrator access is required to review this request.', 403);
        const existing = await DataRightsRequestModel.findById(req.params.id);
        if (existing && req.body.status === 'responded' && req.body.deliveryMethod === 'account') {
          const owner = await UserModel.findOneAndUpdate({ _id: existing.userId, deletedAt: { $exists: false } }, { $set: { updatedAt: new Date() } });
          if (!owner) throw new AppError('This account is closed. Record review progress and arrange verified communication through the privacy team.', 409);
        }
        const record = await DataRightsRequestModel.findOneAndUpdate({ _id: req.params.id, active: true, revision: req.body.revision }, { $set: {
          status: req.body.status, active: req.body.status !== 'responded',
          ...(req.body.status === 'responded' ? { response: req.body.response, respondedAt: new Date(), deliveryMethod: req.body.deliveryMethod } : {}),
        }, $inc: { revision: 1 } }, { new: true });
        if (!record) throw new AppError('Request changed or was already answered. Refresh before reviewing.', 409);
        await DataRightsEventModel.create({ requestId: String(record._id), actorId: req.userId, action: req.body.status, revision: record.revision, evidence: req.body.evidence, ...(req.body.status === 'responded' && req.body.deliveryMethod === 'verified_external' ? { deliveryReference: req.body.deliveryReference } : {}) });
        return record;
      });
      res.json({ data: item });
    } catch (error) { next(error); }
  });
  return router;
}
