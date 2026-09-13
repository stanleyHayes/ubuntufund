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
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundRepositoryPort {
  save(refund: RefundRecord): Promise<RefundRecord>;
  findById(id: string): Promise<RefundRecord | null>;
  /** Enforces one refund request per donation. */
  findByDonationId(donationId: string): Promise<RefundRecord | null>;
  findByRequesterId(requesterId: string): Promise<RefundRecord[]>;
}
