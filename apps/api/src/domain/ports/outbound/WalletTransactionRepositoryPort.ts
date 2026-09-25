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

/** Keyset cursor: the last row of the previous page (newest-first order). */
export interface TransactionCursor {
  createdAt: Date;
  id: string;
}

export interface WalletTransactionRepositoryPort {
  record(input: RecordTransactionInput): Promise<Transaction>;
  /** Newest first; with `before`, only rows strictly older than that cursor. */
  findByUserId(userId: string, limit?: number, before?: TransactionCursor): Promise<Transaction[]>;
}
