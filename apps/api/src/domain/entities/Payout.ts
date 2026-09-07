import type { PayoutProvider, PayoutStatus, PayoutType } from '@ubuntu-fund/types';

export interface PayoutProps {
  id: string;
  campaignId: string;
  recipientId: string;
  amount: number;
  type: PayoutType;
  fee: number;
  netAmount: number;
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
 * Legal payout state transitions.
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
 * A single disbursement of cleared campaign funds. Guards its own status
 * transitions so an illegal move (e.g. paying out an already-FAILED payout)
 * throws rather than silently corrupting the ledger. Concurrency is additionally
 * enforced at the repository via atomic conditional updates, so exactly one
 * caller ever wins a given transition.
 */
export class PayoutEntity {
  private props: PayoutProps;

  constructor(props: PayoutProps) {
    if (props.amount <= 0) {
      throw new Error('Payout amount must be greater than zero');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get recipientId(): string {
    return this.props.recipientId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get type(): PayoutType {
    return this.props.type;
  }
  get fee(): number {
    return this.props.fee;
  }
  get netAmount(): number {
    return this.props.netAmount;
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
      throw new Error(`Illegal payout transition: ${this.props.status} → ${next}`);
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

  toPlain(): PayoutProps {
    return { ...this.props };
  }
}
