import { describe, expect, it } from 'vitest';
import { UserRole, VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import { hasCurrentKyc, isCurrentApproval, kycRenewalOpensAt, latestKycByType, KYC_RENEWAL_WINDOW_DAYS } from '../../../src/domain/services/currentKycEvidence.js';
import { currentVerificationLevel } from '../../../src/domain/services/currentVerificationLevel.js';

const now = new Date('2026-09-20T12:00:00Z');
const day = 86_400_000;
const record = (changes: Partial<KYCVerification> = {}): KYCVerification => ({
  id: 'a', userId: 'owner', verificationType: 'identity', status: 'approved', documents: [], riskLevel: 'low', retryCount: 0,
  createdAt: new Date('2026-01-01'), updatedAt: now, expiryDate: new Date(now.getTime() + 200 * day), ...changes,
});

describe('current KYC evidence', () => {
  it('counts only approvals with a finite expiry in the future', () => {
    expect(isCurrentApproval(record(), now)).toBe(true);
    for (const expiryDate of [undefined, now, new Date(now.getTime() - 1), new Date('invalid')])
      expect(isCurrentApproval(record({ expiryDate }), now)).toBe(false);
    for (const status of ['pending', 'in_review', 'rejected', 'expired'] as const)
      expect(isCurrentApproval(record({ status }), now)).toBe(false);
    expect(isCurrentApproval(null, now)).toBe(false);
  });

  it('lets the newest record of each type decide, breaking createdAt ties by id', () => {
    const older = record({ id: 'a' });
    const newer = record({ id: 'b', status: 'pending', createdAt: new Date('2026-09-01') });
    expect(latestKycByType([older, newer]).get('identity')?.id).toBe('b');
    expect(hasCurrentKyc([older, newer], 'identity', now)).toBe(false);
    const tie = record({ id: 'c', status: 'rejected' });
    expect(latestKycByType([older, tie]).get('identity')?.id).toBe('c');
    expect(hasCurrentKyc([older], 'business', now)).toBe(false);
  });

  it('keeps status, level and allowance consistent for a legacy approval with no expiry', () => {
    const user = { role: UserRole.USER, verificationLevel: VerificationLevel.NATIONAL_ID };
    expect(currentVerificationLevel(user, [record({ expiryDate: undefined })], now)).toBe(VerificationLevel.EMAIL_PHONE);
    expect(currentVerificationLevel(user, [record()], now)).toBe(VerificationLevel.NATIONAL_ID);
  });

  it('opens renewal only inside the window before expiry, so an early update cannot downgrade a verified account', () => {
    const opensAt = kycRenewalOpensAt([record()], 'identity', now);
    expect(opensAt?.getTime()).toBe(now.getTime() + (200 - KYC_RENEWAL_WINDOW_DAYS) * day);
    expect(kycRenewalOpensAt([record({ expiryDate: new Date(now.getTime() + 10 * day) })], 'identity', now)).toBeNull();
    expect(kycRenewalOpensAt([record({ expiryDate: new Date(now.getTime() - day) })], 'identity', now)).toBeNull();
    expect(kycRenewalOpensAt([record({ status: 'rejected' })], 'identity', now)).toBeNull();
    expect(kycRenewalOpensAt([], 'identity', now)).toBeNull();
    expect(kycRenewalOpensAt([record()], 'business', now)).toBeNull();
  });
});
