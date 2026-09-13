import { expect, it } from 'vitest';
import { UserRole, VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import { currentCampaignAllowance } from '../../../src/domain/services/currentCampaignAllowance.js';
const now = new Date('2026-09-13');
const user = { role: UserRole.USER, verificationLevel: VerificationLevel.NATIONAL_ID };
const record = (changes: Partial<KYCVerification> = {}): KYCVerification => ({ id: 'a', userId: 'owner', verificationType: 'identity', status: 'approved', expiryDate: new Date('2027-01-01'), createdAt: new Date('2026-01-01'), updatedAt: now, documents: [], riskLevel: 'low', retryCount: 0, ...changes });
it('requires current evidence for increased allowances and never increases the stored entitlement', () => {
  expect(currentCampaignAllowance(user, [], now)).toBe(1);
  expect(currentCampaignAllowance(user, [record()], now)).toBe(3);
  expect(currentCampaignAllowance({ ...user, verificationLevel: VerificationLevel.NONE }, [record()], now)).toBe(0);
  expect(currentCampaignAllowance({ ...user, verificationLevel: VerificationLevel.EMAIL_PHONE }, [record()], now)).toBe(1);
});
it.each(['pending', 'rejected', 'expired'] as const)('does not revive an older approval behind newer %s evidence', status => {
  expect(currentCampaignAllowance(user, [record(), record({ id: 'b', status, createdAt: new Date('2026-09-01') })], now)).toBe(1);
});
it('requires future finite expiry and role-appropriate business evidence', () => {
  for (const expiryDate of [undefined, now, new Date('invalid')]) expect(currentCampaignAllowance(user, [record({ expiryDate })], now)).toBe(1);
  const organization = { role: UserRole.ORGANIZATION, verificationLevel: VerificationLevel.INSTITUTIONAL };
  expect(currentCampaignAllowance(organization, [record({ verificationType: 'business' })], now)).toBe(10);
  expect(currentCampaignAllowance({ ...organization, role: UserRole.USER }, [record({ verificationType: 'business' })], now)).toBe(1);
});
