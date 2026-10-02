import { expect, it } from 'vitest';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';
import { campaignCreationSubmission, storedCampaignVersion } from '../../../src/domain/services/campaignCreationSubmission.js';
import { publicationFingerprint } from '../../../src/domain/services/publicationFingerprint.js';

/**
 * Campaign proposals approved or declined before 30 September 2026 are matched
 * by fingerprint. These hashes were produced by evaluating the pre-change inline
 * builder in CreateCampaignUseCase (commit 3da2287a) on the inputs below, not
 * by the builder under test, so a change to its text fails here instead of
 * silently orphaning those decisions.
 */
const creatorId = '64b000000000000000000001';
const self = {
  title: 'Clinic roof repair', description: 'The clinic roof leaks every rainy season and patients get wet.',
  category: CampaignCategory.MEDICAL, priority: CampaignPriority.URGENT, beneficiaries: ['Village clinic'], goalAmount: 5000, currency: 'GHS',
  endDate: '2027-01-31T00:00:00.000Z', imageUrls: ['https://res.cloudinary.com/test_cloud/image/upload/v1/cover.jpg'], automatedReviewConsent: true,
};
const onBehalf = {
  ...self, imageUrls: undefined, automatedReviewConsent: false,
  onBehalf: { beneficiaryType: 'individual' as const, beneficiaryName: 'Ama Mensah', beneficiaryEmail: 'ama@example.test', relationship: 'patient' as const, reason: 'Ama needs surgery that her family cannot afford.', payoutArrangement: 'beneficiary' as const },
};

it('fingerprints a campaign exactly as the proposal flow did before 30 September 2026', () => {
  expect(publicationFingerprint(campaignCreationSubmission(self, creatorId))).toBe('a679e643cc9dc1a0eb6dd7130120f6647dae1105299a13df8e4637e73f60ece7');
  expect(publicationFingerprint(campaignCreationSubmission(onBehalf, creatorId))).toBe('04fe808441017ebbb66c8bdd1fe9c51f0328ca55c847b6c3721b52b093398a3c');
});

it('binds the public version only: consent and the beneficiary email never change the fingerprint', () => {
  const pinned = publicationFingerprint(campaignCreationSubmission(onBehalf, creatorId));
  expect(publicationFingerprint(campaignCreationSubmission({ ...onBehalf, automatedReviewConsent: true }, creatorId))).toBe(pinned);
  const otherAddress = { ...onBehalf.onBehalf, beneficiaryEmail: 'other@example.test' };
  expect(publicationFingerprint(campaignCreationSubmission({ ...onBehalf, onBehalf: otherAddress }, creatorId))).toBe(pinned);
  // A stored campaign (Date end date, no email) rebuilds the same version for a decline.
  const { beneficiaryEmail: _email, ...stored } = onBehalf.onBehalf;
  expect(publicationFingerprint(campaignCreationSubmission({ ...onBehalf, endDate: new Date(onBehalf.endDate), imageUrls: [], onBehalf: stored }, creatorId))).toBe(pinned);
  expect(publicationFingerprint(campaignCreationSubmission({ ...onBehalf, title: 'Clinic roof repairs' }, creatorId))).not.toBe(pinned);
});

it('rebuilds the same version from a stored campaign, so a decline or a changed beneficiary binds it', () => {
  const pinned = publicationFingerprint(campaignCreationSubmission(onBehalf, creatorId));
  const { beneficiaryEmail: _email, ...stored } = onBehalf.onBehalf;
  const rebuilt = storedCampaignVersion({ ...onBehalf, endDate: new Date(onBehalf.endDate), imageUrls: [], onBehalf: { ...stored, payoutArrangement: 'beneficiary' } });
  expect(publicationFingerprint(campaignCreationSubmission(rebuilt, creatorId))).toBe(pinned);
  // A new beneficiary is a new version.
  expect(publicationFingerprint(campaignCreationSubmission({ ...rebuilt, onBehalf: { ...rebuilt.onBehalf!, beneficiaryName: 'Kofi Asante' } }, creatorId))).not.toBe(pinned);
});
