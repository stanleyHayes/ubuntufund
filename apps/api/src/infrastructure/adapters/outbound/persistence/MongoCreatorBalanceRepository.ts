import type {
  CreatorBalance,
  CreatorBalanceRepositoryPort,
} from '../../../../domain/ports/outbound/CreatorBalanceRepositoryPort.js';
import {
  CreatorBalanceModel,
  type CreatorBalanceDocument,
} from '../../../database/models/CreatorBalanceModel.js';

function toDomain(doc: CreatorBalanceDocument): CreatorBalance {
  return {
    userId: doc.userId,
    currency: doc.currency,
    availableBalance: doc.availableBalance,
    pendingBalance: doc.pendingBalance,
    paidOutBalance: doc.paidOutBalance,
    totalReceived: doc.totalReceived,
    platformFees: doc.platformFees,
    payoutFees: doc.payoutFees,
  };
}

export class MongoCreatorBalanceRepository
  implements CreatorBalanceRepositoryPort
{
  private settleFilter(userId: string, settleRef?: string): Record<string, unknown> {
    return settleRef
      ? { userId, settledRefs: { $ne: settleRef } }
      : { userId };
  }
  private settleAdd(settleRef?: string): Record<string, unknown> {
    return settleRef ? { $addToSet: { settledRefs: settleRef } } : {};
  }

  async ensure(userId: string, currency: string): Promise<CreatorBalance> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, currency }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    return toDomain(doc!);
  }

  async findByUserId(userId: string): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOne({ userId });
    return doc ? toDomain(doc) : null;
  }

  async creditTip(
    userId: string,
    gross: number,
    fee: number,
    net: number,
    settleRef: string
  ): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      { userId, settledRefs: { $ne: settleRef } },
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: net, totalReceived: gross, platformFees: fee },
        $addToSet: { settledRefs: settleRef },
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reserveForPayout(
    userId: string,
    amount: number
  ): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      { userId, availableBalance: { $gte: amount } },
      { $set: { updatedAt: new Date() }, $inc: { availableBalance: -amount } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async returnToAvailable(
    userId: string,
    amount: number,
    settleRef?: string
  ): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      this.settleFilter(userId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { availableBalance: amount },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async markPaidOut(
    userId: string,
    net: number,
    fee: number,
    settleRef?: string
  ): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      this.settleFilter(userId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: net, payoutFees: fee },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async reverseFromPaidOut(
    userId: string,
    net: number,
    settleRef?: string,
    fee = 0
  ): Promise<CreatorBalance | null> {
    const doc = await CreatorBalanceModel.findOneAndUpdate(
      this.settleFilter(userId, settleRef),
      {
        $set: { updatedAt: new Date() },
        $inc: { paidOutBalance: -net, payoutFees: -fee, availableBalance: net + fee },
        ...this.settleAdd(settleRef),
      },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
