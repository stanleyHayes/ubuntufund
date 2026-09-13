import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { DonationModel } from '../../../../database/models/DonationModel.js';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { UserModel } from '../../../../database/models/UserModel.js';

/** Full administrative ledger read; the public recent-donation feed remains unchanged. */
export function createAdminDonationRoutes(auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  router.use(auth, admin, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
  router.get('/', async (req, res, next) => {
    try {
      const { page, pageSize } = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) }).parse(req.query);
      const [donations, total] = await Promise.all([
        DonationModel.find().select('_id campaignId donorId amount currency paymentMethod isAnonymous createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
        DonationModel.countDocuments(),
      ]);
      const validIds = (values: string[]) => [...new Set(values.filter(value => /^[a-f0-9]{24}$/i.test(value)))];
      const [campaigns, users] = await Promise.all([
        CampaignModel.find({ _id: { $in: validIds(donations.map(item => item.campaignId)) } }).select('_id title').lean(),
        UserModel.find({ _id: { $in: validIds(donations.filter(item => !item.isAnonymous).map(item => item.donorId)) } }).select('_id name').lean(),
      ]);
      const titles = new Map(campaigns.map(item => [String(item._id), item.title]));
      const names = new Map(users.map(item => [String(item._id), item.name]));
      res.json({ data: { total, page, pageSize, items: donations.map(item => ({
        id: String(item._id), campaignId: item.campaignId, campaignTitle: titles.get(item.campaignId) ?? 'Unavailable campaign',
        donorId: item.isAnonymous ? '' : item.donorId, donorName: item.isAnonymous ? 'Anonymous' : names.get(item.donorId) ?? 'Former or guest supporter',
        amount: item.amount, currency: item.currency, paymentMethod: item.paymentMethod, isAnonymous: item.isAnonymous, createdAt: item.createdAt,
      })) } });
    } catch (error) { next(error); }
  });
  return router;
}
