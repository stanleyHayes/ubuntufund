import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

export interface AffiliatePayoutProps {
  id: string;
  affiliateId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  requestedBy: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Legal affiliate-payout state transitions (reuses the Payout status machine).
 *
 *   PENDING    → PROCESSING (admin approves + transfer initiated) | FAILED
 *   PROCESSING → PAID (transfer.success) | FAILED (transfer.failed) |
 *                REVERSED (transfer.reversed before we observed success)
 *   PAID       → REVERSED (transfer.reversed of a settled transfer)
 *   FAILED / REVERSED are terminal.
 */
const ALLOWED_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  PENDING: ['PROCESSING', 'FAILED'],
  PROCESSING: ['PAID', 'FAILED', 'REVERSED'],
  PAID: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
};

/**
 * A single disbursement of accrued affiliate commission. The recipient lives on
 * the Affiliate (its stored payout destination), so — unlike a campaign Payout —
 * there is no recipientId here. Guards its own status transitions so an illegal
 * move (e.g. paying out an already-FAILED payout) throws rather than silently
 * corrupting the ledger. Concurrency is additionally enforced at the repository
 * via atomic conditional updates, so exactly one caller ever wins a given
 * transition.
 */
export class AffiliatePayoutEntity {
  private props: AffiliatePayoutProps;

  constructor(props: AffiliatePayoutProps) {
    if (props.amount <= 0) {
      throw new Error('Affiliate payout amount must be greater than zero');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get affiliateId(): string {
    return this.props.affiliateId;
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
  get transferCode(): string | undefined {
    return this.props.transferCode;
  }
  get requestedBy(): string {
    return this.props.requestedBy;
  }
  get approvedBy(): string | undefined {
    return this.props.approvedBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].length === 0;
  }

  canTransitionTo(next: PayoutStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  private transition(next: PayoutStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(`Illegal affiliate-payout transition: ${this.props.status} → ${next}`);
    }
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  /** Admin approval: reserve funds and initiate the transfer. */
  approve(approvedBy: string, providerRef: string, transferCode?: string): void {
    this.transition('PROCESSING');
    this.props.approvedBy = approvedBy;
    this.props.providerRef = providerRef;
    if (transferCode) this.props.transferCode = transferCode;
  }

  markPaid(): void {
    this.transition('PAID');
  }

  markFailed(): void {
    this.transition('FAILED');
  }

  markReversed(): void {
    this.transition('REVERSED');
  }

  attachTransferCode(transferCode: string): void {
    this.props.transferCode = transferCode;
    this.props.updatedAt = new Date();
  }

  toPlain(): AffiliatePayoutProps {
    return { ...this.props };
  }
}
