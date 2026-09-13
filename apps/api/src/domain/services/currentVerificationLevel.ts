import { VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import type { UserEntity } from '../entities/User.js';

/** Current evidence projection; historical account levels are never modified. */
export function currentVerificationLevel(user: Pick<UserEntity, 'role' | 'verificationLevel'>, records: KYCVerification[], now = new Date()): VerificationLevel {
  const latest = new Map<string, KYCVerification>();
  for (const record of [...records].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id))) {
    if (!latest.has(record.verificationType)) latest.set(record.verificationType, record);
  }
  const current = (type: string) => {
    const record = latest.get(type);
    const expiry = record?.expiryDate ? new Date(record.expiryDate).getTime() : NaN;
    return record?.status === 'approved' && Number.isFinite(expiry) && expiry > now.getTime();
  };
  // Preserve the existing baseline account entitlement; evidence is required
  // for each higher allowance, and never grants more than the stored level.
  let level = user.verificationLevel >= VerificationLevel.EMAIL_PHONE ? VerificationLevel.EMAIL_PHONE : VerificationLevel.NONE;
  if (current('identity')) level = VerificationLevel.NATIONAL_ID;
  if (user.role === 'organization' && current('business')) level = VerificationLevel.INSTITUTIONAL;
  if (current('political') || current('media')) level = VerificationLevel.COMMUNITY;
  return Math.min(level, user.verificationLevel) as VerificationLevel;
}
