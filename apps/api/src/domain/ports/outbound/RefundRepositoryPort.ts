export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RefundRecord {
  id: string;
  donationId: string;
  campaignId: string;
  requesterId: string;
  reason: string;
  description?: string;
  /** Original campaign-directed donation amount. */
  amount: number;
  /** Recorded request fee; new requests are free. Historical values are retained. */
  fee: number;
  /** Requested net amount, not evidence of a completed provider refund. */
  netAmount: number;
  currency: string;
  status: RefundStatus;
  /** Staff explanation of the latest status change (internal; audit-logged). */
  staffNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  /** The admin refund operation that moved the money, when one was used. */
  refundOperationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Staff may move a request forward only. Completed and failed are final: a
 * completed request claims money was returned, so it is never reopened.
 */
export const REFUND_REQUEST_TRANSITIONS: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  pending: ['processing', 'completed', 'failed'],
  processing: ['completed', 'failed'],
  completed: [],
  failed: [],
};

export interface RefundRequestListParams {
  status?: RefundStatus;
  page: number;
  pageSize: number;
}

export interface RefundRequestStatusUpdate {
  status: RefundStatus;
  staffNote: string;
  actorId: string;
  refundOperationId?: string;
}

export interface RefundRepositoryPort {
  save(refund: RefundRecord): Promise<RefundRecord>;
  findById(id: string): Promise<RefundRecord | null>;
  /** Enforces one refund request per donation. */
  findByDonationId(donationId: string): Promise<RefundRecord | null>;
  findByRequesterId(requesterId: string): Promise<RefundRecord[]>;
  /** Refund records for the given donations (at most one each). */
  findByDonationIds(donationIds: string[]): Promise<RefundRecord[]>;
  /** Staff queue, oldest first so no request waits behind newer ones. */
  list(params: RefundRequestListParams): Promise<{ items: RefundRecord[]; total: number }>;
  /**
   * Move a request to `update.status` only from a status allowed by
   * REFUND_REQUEST_TRANSITIONS, writing the audit row in the same transaction.
   * Resolves null when the request is missing or changed concurrently.
   */
  updateStatus(id: string, update: RefundRequestStatusUpdate): Promise<RefundRecord | null>;
}
