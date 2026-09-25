import { VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import type { UserEntity } from '../entities/User.js';
import { isCurrentApproval, latestKycByType } from './currentKycEvidence.js';

/** Current evidence projection; historical account levels are never modified. */
export function currentVerificationLevel(user: Pick<UserEntity, 'role' | 'verificationLevel'>, records: KYCVerification[], now = new Date()): VerificationLevel {
  const latest = latestKycByType(records);
  const current = (type: string) => isCurrentApproval(latest.get(type), now);
  // Preserve the existing baseline account entitlement; evidence is required
  // for each higher allowance, and never grants more than the stored level.
  let level = user.verificationLevel >= VerificationLevel.EMAIL_PHONE ? VerificationLevel.EMAIL_PHONE : VerificationLevel.NONE;
  if (current('identity')) level = VerificationLevel.NATIONAL_ID;
  if (user.role === 'organization' && current('business')) level = VerificationLevel.INSTITUTIONAL;
  if (current('political') || current('media')) level = VerificationLevel.COMMUNITY;
  return Math.min(level, user.verificationLevel) as VerificationLevel;
}
