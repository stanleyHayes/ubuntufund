import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

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
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single disbursement of one beneficiary's cleared share (spec §17 / ADR-3).
 * Single-transfer only, reusing the Payout status machine:
 *
 *   PENDING    → PROCESSING (admin approves + transfer initiated) | FAILED
 *   PROCESSING → PAID | FAILED | REVERSED
 *   PAID       → REVERSED
 *
 * FAILED / REVERSED / NEEDS_REVIEW are terminal (NEEDS_REVIEW is unreachable
 * here but present for the shared status type).
 */
const ALLOWED_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['PAID', 'FAILED', 'REVERSED'],
  PAID: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
  NEEDS_REVIEW: [],
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

  canTransitionTo(next: PayoutStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  toPlain(): BeneficiaryPayoutProps {
    return { ...this.props };
  }
}
