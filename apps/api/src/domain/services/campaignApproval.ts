import { CampaignStatus, UserRole, VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';

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
  const relevant = input.verifications.filter(record => record.verificationType === requiredType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const current = relevant[0];
  // A stale profile badge or older approval cannot override a newer rejection,
  // pending re-verification, missing expiry evidence or expired verification.
  const expiresAt = current?.expiryDate ? new Date(current.expiryDate).getTime() : NaN;
  if (!current || current.status !== 'approved' || !Number.isFinite(expiresAt) || expiresAt <= input.now.getTime()) return false;
  return input.earlierCampaignStatuses.some(status => [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(status));
}
