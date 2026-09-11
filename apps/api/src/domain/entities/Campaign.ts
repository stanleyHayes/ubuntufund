import type {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
} from '@ubuntu-fund/types';
import { Money } from '../value-objects/Money.js';

export interface CampaignProps {
  id: string;
  /** URL-safe vanity handle. Optional on input; defaults to '' until assigned. */
  slug?: string;
  title: string;
  description: string;
  goalAmount: Money;
  raisedAmount: Money;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  creatorId: string;
  beneficiaries: string[];
  imageUrls: string[];
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
  /** Risk/value tier 1–5 (spec §4), derived from the goal at creation. */
  tier?: number;
  /** Platform fee % locked from the organizer's plan at creation (ADR-5). */
  lockedPlatformFeePercent?: number;
}

export class CampaignEntity {
  private props: CampaignProps;

  constructor(props: CampaignProps) {
    this.props = { ...props, slug: props.slug ?? '' };
  }

  get id(): string {
    return this.props.id;
  }
  get slug(): string {
    return this.props.slug ?? '';
  }
  get title(): string {
    return this.props.title;
  }
  get description(): string {
    return this.props.description;
  }
  get goalAmount(): Money {
    return this.props.goalAmount;
  }
  get raisedAmount(): Money {
    return this.props.raisedAmount;
  }
  get category(): CampaignCategory {
    return this.props.category;
  }
  get priority(): CampaignPriority {
    return this.props.priority;
  }
  get status(): CampaignStatus {
    return this.props.status;
  }
  get creatorId(): string {
    return this.props.creatorId;
  }
  get beneficiaries(): string[] {
    return [...this.props.beneficiaries];
  }
  get imageUrls(): string[] {
    return [...this.props.imageUrls];
  }
  get startDate(): Date {
    return this.props.startDate;
  }
  get endDate(): Date {
    return this.props.endDate;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get tier(): number | undefined {
    return this.props.tier;
  }
  get lockedPlatformFeePercent(): number | undefined {
    return this.props.lockedPlatformFeePercent;
  }

  /**
   * Overfunding is allowed: reaching the goal marks a campaign FUNDED but does
   * not close it. A campaign that is doing well should keep its momentum until
   * its end date rather than going dark at its best moment — and this is also
   * what stops a refund from stranding it, since `reverseRaised` drops
   * `raisedAmount` back below the goal without ever restoring ACTIVE.
   *
   * FUNDED therefore means "goal met, still open". Only the end date, or an
   * explicit DRAFT / PENDING_REVIEW / BLOCKED / EXPIRED state, closes a campaign.
   */
  canReceiveDonation(): boolean {
    const open: CampaignStatus[] = ['active' as CampaignStatus, 'funded' as CampaignStatus];
    return open.includes(this.props.status) && !this.isExpired();
  }

  isExpired(): boolean {
    return new Date() > this.props.endDate;
  }

  isFunded(): boolean {
    return this.props.raisedAmount.isGreaterThan(this.props.goalAmount) ||
      this.props.raisedAmount.equals(this.props.goalAmount);
  }

  addDonation(amount: Money): void {
    if (!this.canReceiveDonation()) {
      throw new Error('Campaign cannot receive donations');
    }
    this.props.raisedAmount = this.props.raisedAmount.add(amount);
    this.props.updatedAt = new Date();

    // Mark the milestone; never downgrade a campaign that is already FUNDED.
    if (this.isFunded() && this.props.status === ('active' as CampaignStatus)) {
      this.props.status = 'funded' as CampaignStatus;
    }
  }

  setSlug(slug: string): void {
    this.props.slug = slug;
    this.props.updatedAt = new Date();
  }

  block(_reason?: string): void {
    this.props.status = 'blocked' as CampaignStatus;
    this.props.updatedAt = new Date();
  }

  activate(): void {
    if (this.props.status !== ('pending_review' as CampaignStatus)) {
      throw new Error('Only pending campaigns can be activated');
    }
    this.props.status = 'active' as CampaignStatus;
    this.props.updatedAt = new Date();
  }

  toPlain(): CampaignProps {
    return { ...this.props };
  }
}
