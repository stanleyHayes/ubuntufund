import type { LegalAcceptanceRecord } from '@ubuntu-fund/types';
import type { UserRole, VerificationLevel, OrganizationType } from '@ubuntu-fund/types';
import { Email } from '../value-objects/Email.js';
import { TrustScore } from '../value-objects/TrustScore.js';
import { randomUUID } from 'node:crypto';

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  authVersion?: string;
  avatarUrl?: string;
  /**
   * Set only when the current avatar was admitted as new media through the
   * account-profile review. Legacy or otherwise-set avatars never carry it.
   */
  reviewedAvatarUrl?: string;
  coverUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: TrustScore;
  country?: string;
  organizationName?: string;
  organizationType?: OrganizationType;
  registrationNumber?: string;
  website?: string;
  needsWebsite?: boolean;
  legalAcceptance?: LegalAcceptanceRecord;
  /** Compliance-approved campaign-goal ceiling (spec §18); undefined = plan cap only. */
  complianceApprovedCampaignLimit?: number;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CAMPAIGN_LIMITS_BY_VERIFICATION: Record<number, number> = {
  0: 0, // NONE - cannot create campaigns
  1: 1, // EMAIL_PHONE
  2: 3, // NATIONAL_ID
  3: 10, // INSTITUTIONAL
  4: 25, // COMMUNITY
};

export class UserEntity {
  private props: UserProps;
  readonly originalPasswordHash: string;
  private readonly originalEmailVerified: boolean;

  constructor(props: UserProps) {
    this.props = { ...props };
    this.originalPasswordHash = props.passwordHash;
    this.originalEmailVerified = props.emailVerified;
  }

  get id(): string {
    return this.props.id;
  }
  get email(): Email {
    return this.props.email;
  }
  get name(): string {
    return this.props.name;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get authVersion(): string { return this.props.authVersion ?? ''; }
  get passwordChanged(): boolean { return this.props.passwordHash !== this.originalPasswordHash; }
  get emailVerificationChanged(): boolean { return this.props.emailVerified !== this.originalEmailVerified; }
  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }
  /** True when the current avatar is the exact image staff media review admitted. */
  get hasReviewedAvatar(): boolean {
    return !!this.props.avatarUrl && this.props.avatarUrl === this.props.reviewedAvatarUrl;
  }
  get role(): UserRole {
    return this.props.role;
  }
  get verificationLevel(): VerificationLevel {
    return this.props.verificationLevel;
  }
  get trustScore(): TrustScore {
    return this.props.trustScore;
  }
  get complianceApprovedCampaignLimit(): number | undefined {
    return this.props.complianceApprovedCampaignLimit;
  }

  /** Set (or clear, with undefined) the compliance-approved campaign ceiling. */
  setComplianceApprovedCampaignLimit(limit: number | undefined): void {
    this.props.complianceApprovedCampaignLimit = limit;
    this.props.updatedAt = new Date();
  }
  get country(): string | undefined {
    return this.props.country;
  }
  get emailVerified(): boolean {
    return this.props.emailVerified;
  }
  get organizationName(): string | undefined {
    return this.props.organizationName;
  }
  get organizationType(): OrganizationType | undefined {
    return this.props.organizationType;
  }
  get registrationNumber(): string | undefined {
    return this.props.registrationNumber;
  }
  get legalAcceptance(): LegalAcceptanceRecord | undefined {
    return this.props.legalAcceptance;
  }
  get needsWebsite(): boolean {
    return this.props.needsWebsite ?? false;
  }
  get website(): string | undefined {
    return this.props.website;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  verifyEmail(): void {
    this.props.emailVerified = true;
    this.props.updatedAt = new Date();
  }

  changePassword(newPasswordHash: string): void {
    this.props.passwordHash = newPasswordHash;
    this.props.authVersion = randomUUID();
    this.props.updatedAt = new Date();
  }

  updateTrustScore(newScore: TrustScore): void {
    this.props.trustScore = newScore;
    this.props.updatedAt = new Date();
  }

  canCreateCampaign(currentCampaignCount: number): boolean {
    const limit =
      CAMPAIGN_LIMITS_BY_VERIFICATION[this.props.verificationLevel] ?? 0;
    return currentCampaignCount < limit;
  }

  getCampaignLimit(): number {
    return CAMPAIGN_LIMITS_BY_VERIFICATION[this.props.verificationLevel] ?? 0;
  }

  isAdmin(): boolean {
    return this.props.role === ('admin' as UserRole);
  }

  toPlain(): UserProps {
    return { ...this.props };
  }
}
