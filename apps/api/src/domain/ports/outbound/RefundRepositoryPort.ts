export type RefundStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface RefundRecord {
  id: string;
  donationId: string;
  campaignId: string;
  requesterId: string;
  reason: string;
  description?: string;
  /** Original donation amount, before the processing fee. */
  amount: number;
  /** Processing fee deducted from the refund (2% of amount). */
  fee: number;
  /** Amount actually refunded to the donor (amount - fee). */
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
