import type {
  AffiliateCommissionSource,
  AffiliateCommissionStatus,
} from '@ubuntu-fund/types';

export interface AffiliateCommissionProps {
  id: string;
  affiliateId: string;
  refereeId: string;
  source: AffiliateCommissionSource;
  /** The subscription charge providerRef this was earned on — unique (webhook idempotency). */
  sourceRef: string;
  /** Commission in major GHS units. */
  amount: number;
  currency: string;
  /** The post-coupon charged subscription amount the commission was computed from. */
  baseAmount: number;
  commissionRate: number;
  status: AffiliateCommissionStatus;
  /** When a HELD commission becomes AVAILABLE (end of the clawback hold window). */
  maturesAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Legal commission ledger transitions.
 *
 *   held      → available (hold window elapsed) | reversed (referred sub refunded) |
 *               cancelled (voided administratively)
 *   available → paid (disbursed via an affiliate payout) | reversed | cancelled
 *   paid      → reversed (clawed back after a refund of an already-paid commission)
 *   reversed / cancelled are terminal.
 */
const ALLOWED_TRANSITIONS: Record<AffiliateCommissionStatus, AffiliateCommissionStatus[]> = {
  held: ['available', 'reversed', 'cancelled'],
  available: ['paid', 'reversed', 'cancelled'],
  paid: ['reversed'],
  reversed: [],
  cancelled: [],
};

/**
 * A single affiliate commission earned on a referred user's first paid
 * subscription. Guards its own status transitions so an illegal move (e.g.
 * paying out an already-cancelled commission) throws rather than silently
 * corrupting the ledger. Concurrency is additionally enforced at the repository
 * via atomic conditional updates, so exactly one caller ever wins a transition.
 */
export class AffiliateCommissionEntity {
  private props: AffiliateCommissionProps;

  constructor(props: AffiliateCommissionProps) {
    if (props.amount < 0) {
      throw new Error('Affiliate commission amount cannot be negative');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get affiliateId(): string {
    return this.props.affiliateId;
  }
  get refereeId(): string {
    return this.props.refereeId;
  }
  get source(): AffiliateCommissionSource {
    return this.props.source;
  }
  get sourceRef(): string {
    return this.props.sourceRef;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get baseAmount(): number {
    return this.props.baseAmount;
  }
  get commissionRate(): number {
    return this.props.commissionRate;
  }
  get status(): AffiliateCommissionStatus {
    return this.props.status;
  }
  get maturesAt(): Date {
    return this.props.maturesAt;
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

  canTransitionTo(next: AffiliateCommissionStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  private transition(next: AffiliateCommissionStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Illegal affiliate-commission transition: ${this.props.status} → ${next}`
      );
    }
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  /** Hold window elapsed: the commission is now withdrawable. */
  markAvailable(): void {
    this.transition('available');
  }

  markPaid(): void {
    this.transition('paid');
  }

  markReversed(): void {
    this.transition('reversed');
  }

  markCancelled(): void {
    this.transition('cancelled');
  }

  toPlain(): AffiliateCommissionProps {
    return { ...this.props };
  }
}
