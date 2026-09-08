import type { DonationProvider, DonationIntentStatus } from '@ubuntu-fund/types';

/**
 * A one-off tip to a creator's tip jar (buy-me-a-coffee style). Collected through
 * the same payment gateway as a campaign donation, but settled to the creator's
 * balance rather than a campaign. Reuses the DonationIntentStatus lifecycle
 * (PENDING → SUCCEEDED / FAILED).
 */
export interface TipProps {
  id: string;
  creatorUserId: string;
  amount: number;
  currency: string;
  supporterUserId?: string;
  supporterName?: string;
  supporterEmail?: string;
  message?: string;
  isAnonymous: boolean;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef: string;
  /** Platform fee retained on the tip (major units); net = amount − fee. */
  platformFee: number;
  netAmount: number;
  /** G7: whether the SUCCEEDED tip's balance credit has been recorded. */
  settlementApplied?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class TipEntity {
  private props: TipProps;

  constructor(props: TipProps) {
    if (props.amount <= 0) throw new Error('Tip amount must be greater than zero');
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get creatorUserId(): string {
    return this.props.creatorUserId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get status(): DonationIntentStatus {
    return this.props.status;
  }
  get providerRef(): string {
    return this.props.providerRef;
  }
  get platformFee(): number {
    return this.props.platformFee;
  }
  get netAmount(): number {
    return this.props.netAmount;
  }
  get settlementApplied(): boolean {
    return this.props.settlementApplied ?? false;
  }
  get message(): string | undefined {
    return this.props.message;
  }
  get isAnonymous(): boolean {
    return this.props.isAnonymous;
  }
  get supporterName(): string | undefined {
    return this.props.supporterName;
  }

  toPlain(): TipProps {
    return { ...this.props };
  }
}
