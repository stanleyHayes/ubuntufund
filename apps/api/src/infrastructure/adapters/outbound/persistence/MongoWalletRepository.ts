import { WalletEntity } from '../../../../domain/entities/Wallet.js';
import { Money } from '../../../../domain/value-objects/Money.js';
import type { WalletRepositoryPort } from '../../../../domain/ports/outbound/WalletRepositoryPort.js';
import {
  WalletModel,
  type WalletDocument,
} from '../../../database/models/WalletModel.js';

function toDomain(doc: WalletDocument): WalletEntity {
  return new WalletEntity({
    id: doc._id!.toString(),
    userId: doc.userId,
    type: doc.type,
    balance: new Money(doc.balance, doc.currency),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
}

export class MongoWalletRepository implements WalletRepositoryPort {
  async save(wallet: WalletEntity): Promise<WalletEntity> {
    const plain = wallet.toPlain();
    const doc = await WalletModel.create({
      userId: plain.userId,
      type: plain.type,
      currency: plain.balance.currency,
      balance: plain.balance.amount,
    });
    return toDomain(doc);
  }

  async findById(id: string): Promise<WalletEntity | null> {
    const doc = await WalletModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async findByUserId(userId: string): Promise<WalletEntity[]> {
    const docs = await WalletModel.find({ userId });
    return docs.map(toDomain);
  }

  async update(wallet: WalletEntity): Promise<WalletEntity> {
    const plain = wallet.toPlain();
    const doc = await WalletModel.findByIdAndUpdate(
      plain.id,
      {
        balance: plain.balance.amount,
      },
      { new: true }
    );

    if (!doc) {
      throw new Error('Wallet not found');
    }
    return toDomain(doc);
  }

  async depositAtomic(walletId: string, userId: string, amount: Money): Promise<WalletEntity | null> {
    const doc = await WalletModel.findOneAndUpdate(
      { _id: walletId, userId, currency: amount.currency },
      { $inc: { balance: amount.amount } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }

  async withdrawIfSufficient(
    walletId: string,
    userId: string,
    amount: Money
  ): Promise<WalletEntity | null> {
    const doc = await WalletModel.findOneAndUpdate(
      {
        _id: walletId,
        userId,
        currency: amount.currency,
        balance: { $gte: amount.amount },
      },
      { $inc: { balance: -amount.amount } },
      { new: true }
    );
    return doc ? toDomain(doc) : null;
  }
}
