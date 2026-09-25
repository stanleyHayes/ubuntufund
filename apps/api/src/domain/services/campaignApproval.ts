import { CampaignStatus, UserRole, VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import { hasCurrentKyc } from './currentKycEvidence.js';

/** Goals strictly above this GHS boundary need staff review unless eligible below. */
export const STAFF_REVIEW_GOAL_GHS = 250_000;

export function isVerifiedReturningOrganizer(input: {
  role: UserRole;
  verificationLevel: VerificationLevel;
  verifications: KYCVerification[];
  earlierCampaignStatuses: CampaignStatus[];
  now: Date;
}): boolean {
  const organization = input.role === UserRole.ORGANIZATION;
  const requiredLevel = organization ? VerificationLevel.INSTITUTIONAL : VerificationLevel.NATIONAL_ID;
  if (input.verificationLevel < requiredLevel) return false;
  const requiredType = organization ? 'business' : 'identity';
  // A stale profile badge or older approval cannot override a newer rejection,
  // pending re-verification, missing expiry evidence or expired verification.
  if (!hasCurrentKyc(input.verifications, requiredType, input.now)) return false;
  return input.earlierCampaignStatuses.some(status => [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(status));
}
