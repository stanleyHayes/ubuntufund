import type {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
  BeneficiaryPartyType,
  BeneficiaryRelationship,
  CampaignContentReviewReason,
  CampaignContentReviewTrigger,
  CampaignCreationMode,
  OnBehalfConsentStatus,
  OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types';
import { isContentCheckOutstanding } from '@ubuntu-fund/types';
import { Money } from '../value-objects/Money.js';
import { payoutAuthorityOf } from '../services/campaignPayoutAuthority.js';

/**
 * Private record of how a campaign's current content was admitted, at
 * creation or at a later beneficiary change (`trigger`): never on a public,
 * beneficiary or donor read. `staff_review` content is cleared by the
 * campaign staff review (`contentReviewClearedAt`). Erasing the organizer's
 * account removes the personal and pseudonymous fields (`erasedAt`).
 */
export interface CampaignContentAdmission {
  basis: 'screening' | 'prior_approval' | 'staff_review';
  reason?: CampaignContentReviewReason;
  trigger?: CampaignContentReviewTrigger;
  /** `publicationFingerprint` of the admitted version; absent once erased. */
  fingerprint?: string;
  automatedConsentAt?: Date;
  screenedAt?: Date;
  screener?: string;
  priorReviewId?: string;
  priorReviewReason?: string;
  admittedAt: Date;
  erasedAt?: Date;
}

/** The beneficiary side of a campaign run on someone's behalf. */
export interface CampaignOnBehalfProps {
  beneficiaryType: BeneficiaryPartyType;
  beneficiaryName: string;
  relationship: BeneficiaryRelationship;
  reason: string;
  beneficiaryUserId?: string;
  consentStatus: OnBehalfConsentStatus;
  consentVersion?: string;
  consentAt?: Date;
  consentBy?: string;
  payoutArrangement: OnBehalfPayoutArrangement;
  payoutAuthorityUserId?: string;
  publicationRequiresConsent: boolean;
  donationsRequireConsent: boolean;
  staffReviewRequired: boolean;
  autoPublishOnConsent: boolean;
  /**
   * Set only while the content waits for staff: what `autoPublishOnConsent`
   * becomes once staff clear the content (consent was not the only hold).
   */
  autoPublishAfterContentCheck?: boolean;
  entitlementPlanTier?: string;
  feePercentApplied?: number;
  invitedAt?: Date;
}

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
  reviewRevision?: number;
  /** Absent on campaigns created before this field existed: read as 'self'. */
  creationMode?: CampaignCreationMode;
  creatorType?: 'individual' | 'organization';
  createdByActorId?: string;
  onBehalf?: CampaignOnBehalfProps;
  /** Why the content was sent to staff review; absent when it was cleared automatically. */
  contentReviewReason?: CampaignContentReviewReason;
  /** Set when a beneficiary change, not creation, opened the current content check. */
  contentReviewTrigger?: CampaignContentReviewTrigger;
  /** When, and by which staff member, the campaign review cleared that content check. */
  contentReviewClearedAt?: Date;
  contentReviewClearedBy?: string;
  contentAdmission?: CampaignContentAdmission;
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
  get creationMode(): CampaignCreationMode {
    return this.props.creationMode ?? 'self';
  }
  get onBehalf(): CampaignOnBehalfProps | undefined {
    return this.props.onBehalf ? { ...this.props.onBehalf } : undefined;
  }
  get contentReviewReason(): CampaignContentReviewReason | undefined {
    return this.props.contentReviewReason;
  }
  get contentReviewTrigger(): CampaignContentReviewTrigger | undefined {
    return this.props.contentReviewTrigger;
  }
  /** Private admission evidence (see CampaignContentAdmission); never on a read DTO. */
  get contentAdmission(): CampaignContentAdmission | undefined {
    return this.props.contentAdmission ? { ...this.props.contentAdmission } : undefined;
  }
  get contentReviewClearedAt(): Date | undefined {
    return this.props.contentReviewClearedAt;
  }
  /**
   * From creation until staff clear it, content that waits for a person stays
   * with the organizer and staff: no beneficiary or collaborator invitation
   * carries it, and nothing publishes it.
   */
  get contentCheckOutstanding(): boolean {
    return isContentCheckOutstanding(this.props);
  }
  /** Whoever may request payouts now; null when nobody may (see payoutAuthorityOf). */
  get payoutAuthorityId(): string | null {
    return payoutAuthorityOf(this.props);
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
    return open.includes(this.props.status) && !this.isExpired() && !this.awaitingBeneficiaryConsent();
  }

  /**
   * A campaign run on someone's behalf may be created with "no donations until
   * the beneficiary accepts" locked on. Every donation rail and settlement ask
   * canReceiveDonation, so the gate cannot be bypassed by one of them.
   */
  awaitingBeneficiaryConsent(): boolean {
    const onBehalf = this.props.onBehalf;
    return this.creationMode === 'on_behalf' && !!onBehalf?.donationsRequireConsent && onBehalf.consentStatus !== 'accepted';
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
