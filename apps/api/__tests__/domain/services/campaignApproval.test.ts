import { it, expect } from 'vitest';
import { CampaignStatus, UserRole, VerificationLevel, type KYCVerification } from '@ubuntu-fund/types';
import { isVerifiedReturningOrganizer } from '../../../src/domain/services/campaignApproval.js';
const now = new Date('2026-09-12');
const approved: KYCVerification = { id: 'kyc', userId: 'user', verificationType: 'identity', status: 'approved', documents: [], riskLevel: 'low', retryCount: 0, createdAt: new Date('2026-08-01'), updatedAt: now, expiryDate: new Date('2027-01-01') };
const input = { role: UserRole.USER, verificationLevel: VerificationLevel.NATIONAL_ID, verifications: [approved], earlierCampaignStatuses: [CampaignStatus.ACTIVE], now };
it('does not accept an email-only badge, wrong verification type or stale approval overridden by newer review', () => {
  expect(isVerifiedReturningOrganizer(input)).toBe(true);
  expect(isVerifiedReturningOrganizer({ ...input, verificationLevel: VerificationLevel.EMAIL_PHONE })).toBe(false);
  expect(isVerifiedReturningOrganizer({ ...input, role: UserRole.ORGANIZATION, verificationLevel: VerificationLevel.INSTITUTIONAL })).toBe(false);
  for (const status of ['pending', 'in_review', 'rejected', 'expired'] as const) {
    expect(isVerifiedReturningOrganizer({ ...input, verifications: [approved, { ...approved, id: 'new', status, createdAt: now }] })).toBe(false);
  }
});
it('requires published history and valid, current expiry evidence', () => {
  for (const status of [CampaignStatus.DRAFT, CampaignStatus.PENDING_REVIEW, CampaignStatus.BLOCKED]) {
    expect(isVerifiedReturningOrganizer({ ...input, earlierCampaignStatuses: [status] })).toBe(false);
  }
  for (const expiryDate of [undefined, now, new Date('invalid')]) {
    expect(isVerifiedReturningOrganizer({ ...input, verifications: [{ ...approved, expiryDate }] })).toBe(false);
  }
  expect(isVerifiedReturningOrganizer({ ...input, earlierCampaignStatuses: [] })).toBe(false);
});
