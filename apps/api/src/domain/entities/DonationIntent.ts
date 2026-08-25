import type {
  DonationIntentStatus,
  DonationProvider,
} from '@ubuntu-fund/types';

export interface DonationIntentProps {
  id: string;
  campaignId: string;
  liveSessionId?: string;
  amount: number;
  currency: string;
  donorUserId: string | null;
  donorEmail?: string;
  donorName?: string;
  message?: string;
  isAnonymous: boolean;
  tip: number;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef?: string;
  idempotencyKey: string;
  attribution?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Legal state transitions. CREATED can go straight to SUCCEEDED for the
 * synchronous wallet rail; hosted rails move through PENDING first. SUCCEEDED,
 * FAILED, and EXPIRED are terminal (no outgoing transitions).
 */
const ALLOWED_TRANSITIONS: Record<DonationIntentStatus, DonationIntentStatus[]> = {
  CREATED: ['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
  PENDING: ['SUCCEEDED', 'FAILED', 'EXPIRED'],
  SUCCEEDED: [],
  FAILED: [],
  EXPIRED: [],
};

/**
 * A guest-capable donation intent — the money-changing record a donation flows
 * through. Guards its own status transitions so an illegal move (e.g.
 * re-settling a FAILED intent) throws rather than silently corrupting state.
 */
export class DonationIntentEntity {
  private props: DonationIntentProps;

  constructor(props: DonationIntentProps) {
    if (props.amount <= 0) {
      throw new Error('Donation amount must be greater than zero');
    }
    if (props.tip < 0) {
      throw new Error('Tip cannot be negative');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get liveSessionId(): string | undefined {
    return this.props.liveSessionId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get donorUserId(): string | null {
    return this.props.donorUserId;
  }
  get donorEmail(): string | undefined {
    return this.props.donorEmail;
  }
  get donorName(): string | undefined {
    return this.props.donorName;
  }
  get message(): string | undefined {
    return this.props.message;
  }
  get isAnonymous(): boolean {
    return this.props.isAnonymous;
  }
  get tip(): number {
    return this.props.tip;
  }
  get status(): DonationIntentStatus {
    return this.props.status;
  }
  get provider(): DonationProvider {
    return this.props.provider;
  }
  get providerRef(): string | undefined {
    return this.props.providerRef;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get attribution(): string | undefined {
    return this.props.attribution;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Total the donor is charged: campaign-directed amount plus any tip. */
  get gross(): number {
    return Math.round((this.props.amount + this.props.tip) * 100) / 100;
  }

  isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].length === 0;
  }

  canTransitionTo(next: DonationIntentStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  private transition(next: DonationIntentStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Illegal donation-intent transition: ${this.props.status} → ${next}`
      );
    }
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  markPending(providerRef?: string): void {
    this.transition('PENDING');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markSucceeded(providerRef?: string): void {
    this.transition('SUCCEEDED');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markFailed(providerRef?: string): void {
    this.transition('FAILED');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markExpired(): void {
    this.transition('EXPIRED');
  }

  toPlain(): DonationIntentProps {
    return { ...this.props };
  }
}
