export type RefundOperationState = 'submitting' | 'provider_pending' | 'provider_unknown' | 'provider_failed' | 'reversal_pending' | 'completed';
export interface RefundOperation {
  id: string;
  intentId: string;
  campaignId: string;
  provider: string;
  transactionReference: string;
  requestKey: string;
  adminId: string;
  amount: number;
  amountMinor: number;
  cumulativeMinor: number;
  maxMinor: number;
  currency: string;
  beneficiaryNet: number;
  platformFee: number;
  processorFee: number;
  fundsHoldVersion?: 1;
  beneficiaryHolds?: { beneficiaryId: string; amount: number }[];
  state: RefundOperationState;
  active: boolean;
  providerReference?: string;
  issue?: 'provider_unconfirmed' | 'provider_pending' | 'provider_failed' | 'local_reversal_failed';
  createdAt: Date;
  updatedAt: Date;
}
export interface RefundOperationRepositoryPort {
  findActiveByIntentId(intentId: string): Promise<RefundOperation | null>;
  findById(id: string): Promise<RefundOperation | null>;
  create(operation: RefundOperation): Promise<void>;
  update(id: string, expected: RefundOperationState[], patch: Partial<Pick<RefundOperation, 'state' | 'active' | 'providerReference' | 'issue'>>): Promise<boolean>;
  listUnresolved(page: number, pageSize?: number): Promise<{ items: RefundOperation[]; total: number }>;
  /** Whether Ujimora itself requested a refund of this amount on this transaction. */
  existsForTransaction(transactionReference: string, amountMinor?: number): Promise<boolean>;
}
