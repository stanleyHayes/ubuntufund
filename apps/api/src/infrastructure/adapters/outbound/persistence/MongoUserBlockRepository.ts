import type { UserBlockRepositoryPort } from '../../../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { UserBlockModel } from '../../../database/models/UserBlockModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
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
    await this.change(userId, blockedUserId, async () => {
      await UserBlockModel.updateOne({ userId, blockedUserId }, { $setOnInsert: { userId, blockedUserId }, $set: { providerCleanupPending: true } }, { upsert: true });
    });
  }
  async unblock(userId: string, blockedUserId: string): Promise<void> {
    await this.change(userId, blockedUserId, async () => {
      await UserBlockModel.deleteOne({ userId, blockedUserId });
    });
  }
  private async change(userId: string, blockedUserId: string, work: () => Promise<void>): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      // Publication transactions write the author's account before reading blocks.
      // Touch both participants so either direction conflicts with an older
      // publication snapshot. Stable ordering also serializes reciprocal blocks.
      for (const id of [...new Set([userId, blockedUserId])].sort()) {
        await UserModel.updateOne({ _id: id }, { $inc: { publicationWriteVersion: 1 } }, { timestamps: false });
      }
      await work();
    });
  }
}
