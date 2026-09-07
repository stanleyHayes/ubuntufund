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

  canReceiveDonation(): boolean {
    return this.props.status === 'active' && !this.isExpired();
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

    if (this.isFunded()) {
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
