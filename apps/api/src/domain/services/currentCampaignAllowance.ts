import type { KYCVerification } from '@ubuntu-fund/types';
import type { UserEntity } from '../entities/User.js';
import { currentVerificationLevel } from './currentVerificationLevel.js';

/** Historical account levels cannot keep evidence-dependent campaign allowances alive. */
export function currentCampaignAllowance(user: Pick<UserEntity, 'role' | 'verificationLevel'>, records: KYCVerification[], now = new Date()): number {
  return [0, 1, 3, 10, 25][currentVerificationLevel(user, records, now)] ?? 0;
}
