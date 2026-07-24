import type { Transaction, TransactionType } from '@ubuntu-fund/types';

export interface RecordTransactionInput {
  walletId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  reference: string;
  metadata?: Record<string, unknown>;
}

export interface WalletTransactionRepositoryPort {
  record(input: RecordTransactionInput): Promise<Transaction>;
  findByUserId(userId: string, limit?: number): Promise<Transaction[]>;
}
