import type { Transaction } from '@ubuntu-fund/types';
import type {
  RecordTransactionInput,
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

  async findByUserId(userId: string, limit = 50): Promise<Transaction[]> {
    const docs = await WalletTransactionModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit);
    return docs.map(toTransaction);
  }
}
