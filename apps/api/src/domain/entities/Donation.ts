import { isDonationContentApproved } from './donationPublicContent.js';
import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import { Money } from '../value-objects/Money.js';
import { PaymentMethod } from '@ubuntu-fund/types';

/** Guest checkout has no associated user record. Never use this as a user ID. */
export const GUEST_DONOR_ID = 'guest';

export interface DonationProps {
  id: string;
  campaignId: string;
  donorId: string;
  amount: Money;
  /**
   * Optional platform tip charged with the donation, in the donation's
   * currency. Not part of `amount` (the campaign-directed sum); recorded so
   * the donor's confirmation can state the total they were charged.
   */
  tip?: number;
  paymentMethod: PaymentMethod;
  publicContentStatus?: 'pending' | 'approved' | 'rejected';
  publicContentFingerprint?: string;
  publicContentRevokedAt?: Date;
  donorName?: string;
  messageHiddenAt?: Date;
  messageAgreement?: LegalAcceptanceRecord;
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
  get publicContentApproved(): boolean { return isDonationContentApproved(this.props); }
  get publicMessage(): string | undefined { return this.publicContentApproved && !this.props.messageHiddenAt ? this.props.message : undefined; }
  get publicDonorName(): string | undefined { return !this.props.isAnonymous && this.publicContentApproved ? this.props.donorName || (this.props.donorId === GUEST_DONOR_ID ? 'Guest donor' : 'Supporter') : undefined; }
  get paymentMethod(): PaymentMethod {
    return this.props.paymentMethod;
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
