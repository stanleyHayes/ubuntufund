import type { UserRole, VerificationLevel } from '@ubuntu-fund/types';
import { Email } from '../value-objects/Email.js';
import { TrustScore } from '../value-objects/TrustScore.js';

export interface UserProps {
  id: string;
  email: Email;
  name: string;
  passwordHash: string;
  avatarUrl?: string;
  role: UserRole;
  verificationLevel: VerificationLevel;
  trustScore: TrustScore;
  country?: string;
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

  constructor(props: UserProps) {
    this.props = { ...props };
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
  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
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
  get country(): string | undefined {
    return this.props.country;
  }
  get emailVerified(): boolean {
    return this.props.emailVerified;
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
