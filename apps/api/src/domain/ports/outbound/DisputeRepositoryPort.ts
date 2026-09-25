export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export interface DisputeRecord {
  id: string;
  campaignId: string;
  reporterId: string;
  assigneeId?: string;
  reason: string;
  description?: string;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  /** Who raised it: staff (default) or a payment provider's webhook. */
  source?: 'staff' | 'paystack';
  /** Provider's id for the case (unique per provider case); absent for staff disputes. */
  providerDisputeId?: string;
  /** The charged transaction the provider case is about. */
  transactionReference?: string;
  donationIntentId?: string;
  /** Disputed/refunded amount in major units of `currency`, when the provider reports it. */
  amount?: number;
  currency?: string;
  /** Provider's evidence deadline. */
  dueAt?: Date;
  /** Latest provider status / resolution for the case (e.g. 'merchant-accepted'). */
  providerStatus?: string;
  providerResolution?: string;
  /** The accounting-only refund operation that recorded this provider reversal. */
  reversalOperationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A provider-originated case (a chargeback, or a refund issued outside
 * Ujimora) to open or update in the staff dispute queue. Idempotent on
 * `providerDisputeId`: a redelivered or reminder webhook updates the same row.
 */
export interface ProviderDisputeInput {
  providerDisputeId: string;
  source: 'paystack';
  campaignId: string;
  reason: string;
  description: string;
  transactionReference: string;
  donationIntentId?: string;
  amount?: number;
  currency?: string;
  dueAt?: Date;
  providerStatus?: string;
  providerResolution?: string;
  /**
   * The provider closed the case. Never auto-resolves: an open case moves to
   * under_review so staff account for the outcome.
   */
  providerClosed?: boolean;
}

export interface DisputeListParams {
  status?: DisputeStatus;
  page?: number;
  pageSize?: number;
}

export interface DisputeResolution {
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
}

export interface DisputeRepositoryPort {
  save(dispute: DisputeRecord): Promise<DisputeRecord>;
  findById(id: string): Promise<DisputeRecord | null>;
  findAll(
    params: DisputeListParams
  ): Promise<{ items: DisputeRecord[]; total: number }>;
  /**
   * Applies a status/resolution update. Returns the updated record, or null
   * when the dispute does not exist.
   */
  updateStatus(
    id: string,
    updates: DisputeResolution
  ): Promise<DisputeRecord | null>;
  /** Open or update a provider-originated case (see {@link ProviderDisputeInput}). */
  upsertProviderDispute(input: ProviderDisputeInput): Promise<{ record: DisputeRecord; created: boolean }>;
  /** Link a recorded provider reversal to its case. Null when the case does not exist. */
  linkReversal(id: string, operationId: string): Promise<DisputeRecord | null>;
}
