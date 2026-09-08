import type { PayoutProvider, PayoutStatus } from '@ubuntu-fund/types';

/** A creator's self-service withdrawal of their tip balance to bank/mobile-money. */
export interface CreatorPayoutProps {
  id: string;
  creatorUserId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  providerRef?: string;
  transferCode?: string;
  recipientCode?: string;
  recipientName?: string;
  settlementApplied?: boolean;
  reversedFrom?: 'PAID' | 'PROCESSING';
  createdAt: Date;
  updatedAt: Date;
}

export class CreatorPayoutEntity {
  private props: CreatorPayoutProps;

  constructor(props: CreatorPayoutProps) {
    if (props.amount <= 0) throw new Error('Withdrawal amount must be greater than zero');
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
  get status(): PayoutStatus {
    return this.props.status;
  }
  get providerRef(): string | undefined {
    return this.props.providerRef;
  }
  get reversedFrom(): 'PAID' | 'PROCESSING' | undefined {
    return this.props.reversedFrom;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPlain(): CreatorPayoutProps {
    return { ...this.props };
  }
}
