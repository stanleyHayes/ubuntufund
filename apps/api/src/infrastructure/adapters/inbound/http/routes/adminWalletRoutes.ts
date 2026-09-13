import { Router, type RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { AppError } from '../../middleware/errorHandler.js';
import { WalletModel } from '../../../../database/models/WalletModel.js';
import { WalletTransactionModel } from '../../../../database/models/WalletTransactionModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';

const query = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  userId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
});

/** Read-only staff view. Explicit fields exclude provider credentials and payment metadata. */
export function createAdminWalletRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const { page, pageSize, userId } = query.parse(req.query);
      const filter = userId ? { userId } : {};
      const [wallets, total] = await Promise.all([
        WalletModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        WalletModel.countDocuments(filter),
      ]);
      const ids = wallets.map(w => w.userId).filter(id => /^[a-f0-9]{24}$/i.test(id));
      const users = await UserModel.find({ _id: { $in: ids } }).select('_id name').lean();
      const names = new Map(users.map(u => [String(u._id), u.name]));
      res.json({ data: { total, page, pageSize, items: wallets.map(w => ({ id: String(w._id), userId: w.userId, memberName: names.get(w.userId) ?? 'Former member', type: w.type, currency: w.currency, balance: w.balance, updatedAt: w.updatedAt })) } });
    } catch (error) { next(error instanceof ZodError ? new AppError('Invalid pagination or member filter', 400) : error); }
  });
  router.get('/transactions', async (req, res, next) => {
    try {
      const { page, pageSize, userId } = query.parse(req.query);
      const filter = userId ? { userId } : {};
      const [items, total] = await Promise.all([
        WalletTransactionModel.find(filter).select('_id walletId userId type status amount currency reference createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        WalletTransactionModel.countDocuments(filter),
      ]);
      res.json({ data: { total, page, pageSize, items: items.map(t => ({ id: String(t._id), walletId: t.walletId, userId: t.userId, type: t.type, status: t.status, amount: t.amount, currency: t.currency, reference: t.reference, createdAt: t.createdAt })) } });
    } catch (error) { next(error instanceof ZodError ? new AppError('Invalid pagination or member filter', 400) : error); }
  });
  return router;
}
