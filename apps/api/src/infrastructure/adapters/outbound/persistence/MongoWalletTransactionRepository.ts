import mongoose from 'mongoose';
import type { Transaction } from '@ubuntu-fund/types';
import type {
  RecordTransactionInput,
  TransactionCursor,
  WalletTransactionRepositoryPort,
} from '../../../../domain/ports/outbound/WalletTransactionRepositoryPort.js';
import {
  WalletTransactionModel,
  type WalletTransactionDocument,
} from '../../../database/models/WalletTransactionModel.js';

function toTransaction(doc: WalletTransactionDocument): Transaction {
  return {
    id: doc._id!.toString(),
    walletId: doc.walletId,
    type: doc.type,
    status: doc.status,
    amount: doc.amount,
    currency: doc.currency,
    reference: doc.reference,
    metadata: doc.metadata,
    createdAt: doc.createdAt,
  };
}

export class MongoWalletTransactionRepository implements WalletTransactionRepositoryPort {
  async record(input: RecordTransactionInput): Promise<Transaction> {
    const doc = await WalletTransactionModel.create(input);
    return toTransaction(doc);
  }

  async findByUserId(userId: string, limit = 50, before?: TransactionCursor): Promise<Transaction[]> {
    // Keyset pagination on (createdAt, _id) so a page never repeats or skips
    // rows that share a timestamp.
    const filter: Record<string, unknown> = { userId };
    if (before && mongoose.isValidObjectId(before.id)) {
      filter.$or = [
        { createdAt: { $lt: before.createdAt } },
        { createdAt: before.createdAt, _id: { $lt: new mongoose.Types.ObjectId(before.id) } },
      ];
    }
    const docs = await WalletTransactionModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
    return docs.map(toTransaction);
  }
}
