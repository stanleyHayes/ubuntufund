import { expect, it } from 'vitest';
import { messageAgreement, donationContentAgreement } from '../../../src/application/services/messageAgreement.js';
it('requires current explicit agreement only when a public message is supplied', () => {
  expect(messageAgreement()).toBeUndefined();
  expect(messageAgreement('  ')).toBeUndefined();
  expect(() => messageAgreement('My public message')).toThrow('Accept the current content terms');
  expect(() => messageAgreement('Message', { version: 'old', acceptedTerms: true, ageConfirmed: true })).toThrow();
  expect(() => messageAgreement('Message', { version: '2026-09-12', acceptedTerms: true, ageConfirmed: false })).toThrow();
  const result = messageAgreement('Message', { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true });
  expect(result?.acceptedAt).toBeInstanceOf(Date);
  expect(result?.version).toBe('2026-09-12');
});

it('requires acknowledgement for public names but not private anonymous names', () => {
  expect(() => donationContentAgreement({ donorName: 'Public donor' })).toThrow('Accept the current content terms');
  expect(donationContentAgreement({ donorName: 'Private donor', isAnonymous: true })).toBeUndefined();
  expect(() => donationContentAgreement({ donorName: 'Private donor', isAnonymous: true, message: 'Public message' })).toThrow();
  expect(() => donationContentAgreement({ donorName: 'Name', legalAcceptance: { version: 'old', acceptedTerms: true, ageConfirmed: true } })).toThrow();
  const record = donationContentAgreement({ donorName: 'Name', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } });
  expect(record?.acceptedAt).toBeInstanceOf(Date);
});
