import type { PayoutClosure, PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface BeneficiaryPayoutProps {
  id: string;
  campaignId: string;
  beneficiaryId: string;
  recipientId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
  firstApprovedBy?: string;
  firstApprovedAt?: Date;
  firstApprovalFingerprint?: string;
  /**
   * Fingerprint of the destination this payout was requested against. Approval
   * pays only that destination; a replaced one needs a new request.
   */
  destinationFingerprint?: string;
  /** What the request moved pending → available; a close returns exactly this. */
  clearedAmount?: number;
  /** Set when a PENDING request was rejected or cancelled before any transfer. */
  closure?: PayoutClosure;
  /** For a REVERSED payout, the status it reversed from (G7 repair). */
  reversedFrom?: 'PAID' | 'PROCESSING';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single disbursement of one beneficiary's cleared share (spec §17 / ADR-3).
 * Single-transfer only, reusing the Payout status machine:
 *
 *   PENDING    → PROCESSING (admin approves + transfer initiated)
 *              | FAILED (rejected by an admin or cancelled before any transfer)
 *   PROCESSING → PAID | FAILED | REVERSED
 *   PAID       → REVERSED
 *
 * FAILED / REVERSED are terminal. NEEDS_REVIEW holds a transfer the provider
 * could not confirm for a full dwell window until an admin resolves it.
 */
const ALLOWED_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED'],
  // NEEDS_REVIEW: the provider could not confirm the transfer for a full
  // dwell window. It returns to PROCESSING only when an admin resolution
  // re-drives the provider's authoritative outcome through settlement.
  PROCESSING: ['PAID', 'FAILED', 'REVERSED', 'NEEDS_REVIEW'],
  PAID: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
  NEEDS_REVIEW: ['PROCESSING'],
};

export class BeneficiaryPayoutEntity {
  private props: BeneficiaryPayoutProps;

  constructor(props: BeneficiaryPayoutProps) {
    if (props.amount <= 0) {
      throw new Error('Beneficiary payout amount must be greater than zero');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get beneficiaryId(): string {
    return this.props.beneficiaryId;
  }
  get recipientId(): string {
    return this.props.recipientId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get status(): PayoutStatus {
    return this.props.status;
  }
  get provider(): PayoutProvider {
    return this.props.provider;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get providerRef(): string | undefined {
    return this.props.providerRef;
  }
  get requestedBy(): string {
    return this.props.requestedBy;
  }
  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }
  get firstApprovedBy(): string | undefined {
    return this.props.firstApprovedBy;
  }
  get destinationFingerprint(): string | undefined {
    return this.props.destinationFingerprint;
  }
  get clearedAmount(): number | undefined {
    return this.props.clearedAmount;
  }
  get closure(): PayoutClosure | undefined {
    return this.props.closure;
  }
  get reversedFrom(): 'PAID' | 'PROCESSING' | undefined {
    return this.props.reversedFrom;
  }

  canTransitionTo(next: PayoutStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  toPlain(): BeneficiaryPayoutProps {
    return { ...this.props };
  }
}
