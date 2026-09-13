import type { UserBlockRepositoryPort } from '../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { UserBlockModel } from '../../../database/models/UserBlockModel.js';
export class MongoUserBlockRepository implements UserBlockRepositoryPort {
  async excludedUserIds(userId: string): Promise<string[]> {
    const rows = await UserBlockModel.find({ $or: [{ userId }, { blockedUserId: userId }] }).lean();
    return [...new Set(rows.map(row => row.userId === userId ? row.blockedUserId : row.userId))];
  }
  async isBlocked(first: string, second: string): Promise<boolean> {
    return !!await UserBlockModel.exists({ $or: [{ userId: first, blockedUserId: second }, { userId: second, blockedUserId: first }] });
  }
  async list(userId: string): Promise<string[]> {
    return (await UserBlockModel.find({ userId }).sort({ createdAt: -1 }).lean()).map(row => row.blockedUserId);
  }
  async block(userId: string, blockedUserId: string): Promise<void> {
    try { await UserBlockModel.updateOne({ userId, blockedUserId }, { $setOnInsert: { userId, blockedUserId }, $set: { providerCleanupPending: true } }, { upsert: true }); }
    catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
  }
  async unblock(userId: string, blockedUserId: string): Promise<void> {
    await UserBlockModel.deleteOne({ userId, blockedUserId });
  }
}
