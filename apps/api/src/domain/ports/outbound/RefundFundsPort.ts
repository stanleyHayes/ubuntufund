import type { RefundOperation } from './RefundOperationRepositoryPort.js';

/** Both methods require the caller's database transaction. */
export interface RefundFundsPort {
  reserve(operation: RefundOperation): Promise<{ beneficiaryId: string; amount: number }[]>;
  restoreForReversal(operation: RefundOperation): Promise<void>;
}
