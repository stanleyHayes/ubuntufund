import { Money } from '../value-objects/Money.js';

export interface DonationProps {
  id: string;
  campaignId: string;
  donorId: string;
  amount: Money;
  message?: string;
  isAnonymous: boolean;
  createdAt: Date;
}

export class DonationEntity {
  private props: DonationProps;

  constructor(props: DonationProps) {
    if (props.amount.isZero()) {
      throw new Error('Donation amount must be greater than zero');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get donorId(): string {
    return this.props.donorId;
  }
  get amount(): Money {
    return this.props.amount;
  }
  get message(): string | undefined {
    return this.props.message;
  }
  get isAnonymous(): boolean {
    return this.props.isAnonymous;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toPlain(): DonationProps {
    return { ...this.props };
  }
}
