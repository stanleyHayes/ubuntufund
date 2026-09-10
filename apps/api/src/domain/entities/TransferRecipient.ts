import type { PayoutRecipientType } from '@ubuntu-fund/types';

export interface TransferRecipientProps {
  id: string;
  campaignId: string;
  createdBy: string;
  type: PayoutRecipientType;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  recipientCode: string;
  currency: string;
  verificationStatus?: 'name_matched' | 'needs_review';
  resolvedAccountName?: string;
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

/**
 * A provider-registered payout destination for a campaign. Immutable once
 * created — a new recipient is registered rather than edited, so the
 * `recipientCode` a transfer was addressed to is never rewritten underneath it.
 */
export class TransferRecipientEntity {
  private readonly props: TransferRecipientProps;

  constructor(props: TransferRecipientProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get type(): PayoutRecipientType {
    return this.props.type;
  }
  get accountNumber(): string {
    return this.props.accountNumber;
  }
  get bankCode(): string {
    return this.props.bankCode;
  }
  get accountName(): string {
    return this.props.accountName;
  }
  get recipientCode(): string {
    return this.props.recipientCode;
  }
  get currency(): string {
    return this.props.currency;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toPlain(): TransferRecipientProps {
    return { ...this.props };
  }
}
