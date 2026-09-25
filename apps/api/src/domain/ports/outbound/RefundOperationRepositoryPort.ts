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
  /**
   * Set when the operation only records money a provider already returned (a
   * refund issued in the provider dashboard, or a chargeback). No provider
   * call is ever made for it; absent for console refunds Ujimora submitted.
   */
  origin?: 'provider_refund' | 'provider_chargeback';
  /** The provider refund webhook matched to this operation (one refund per operation). */
  webhookRefundKey?: string;
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
  findByRequestKey(intentId: string, requestKey: string): Promise<RefundOperation | null>;
  /**
   * Whether a refund the provider reported is one Ujimora submitted, matching
   * one provider refund to at most one console refund operation: by the
   * provider refund id or the operation id in the merchant note when the event
   * carries them, else by atomically claiming a single still-unmatched
   * operation of the same transaction and amount that can still produce it.
   * False (not ours) when the refund cannot be identified that way.
   */
  claimProviderRefund(match: ProviderRefundMatch): Promise<boolean>;
}

export interface ProviderRefundMatch {
  transactionReference: string;
  amountMinor?: number;
  /** The provider's own refund id, when the event carries it. */
  providerRefundId?: string;
  /** Operation id recovered from the refund's merchant note, when present. */
  operationId?: string;
  /** Stable key of this provider refund (refund reference or id). */
  refundKey?: string;
}
