import { expect, it } from 'vitest';
import { GetDonationIntentPublicUseCase } from '../../../src/application/use-cases/GetDonationIntentPublicUseCase.js';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';
import { DonationEntity } from '../../../src/domain/entities/Donation.js';
import { donationContentVersion } from '../../../src/domain/entities/donationPublicContent.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { PaymentMethod } from '@ubuntu-fund/types';

const intent = new DonationIntentEntity({ id: 'intent', campaignId: 'campaign', donorUserId: null, amount: 20, tip: 0, currency: 'GHS', status: 'SUCCEEDED', provider: 'paystack', isAnonymous: false, donorName: 'Secret name', message: 'Secret message', donorEmail: 'secret@example.com', idempotencyKey: 'secret-key', createdAt: new Date(), updatedAt: new Date() });
const original = { id: 'donation', campaignId: 'campaign', donorId: 'guest', donorName: 'Secret name', message: 'Secret message', amount: new Money(20, 'GHS'), paymentMethod: PaymentMethod.WALLET, isAnonymous: false, createdAt: new Date() };
it('projects current approval and invalidates edited content without exposing submitted text', async () => {
  let donation = new DonationEntity(original);
  const useCase = new GetDonationIntentPublicUseCase({ findById: async () => intent } as never, { findEntryByDonationIntentId: async () => ({ donationId: 'donation' }) } as never, { findById: async () => donation } as never);
  expect((await useCase.execute('intent')).contentReviewStatus).toBe('pending');
  donation = new DonationEntity({ ...original, publicContentStatus: 'approved', publicContentFingerprint: donationContentVersion(original) });
  const approved = await useCase.execute('intent');
  expect(approved).toMatchObject({ status: 'SUCCEEDED', amount: 20, contentReviewStatus: 'approved' });
  expect(JSON.stringify(approved)).not.toMatch(/Secret|secret@example|secret-key/);
  donation = new DonationEntity({ ...donation.toPlain(), message: 'Changed message' });
  expect((await useCase.execute('intent')).contentReviewStatus).toBe('pending');
  donation = new DonationEntity({ ...original, publicContentStatus: 'rejected' });
  expect((await useCase.execute('intent')).contentReviewStatus).toBe('rejected');
  donation = new DonationEntity({ ...original, publicContentRevokedAt: new Date() });
  expect((await useCase.execute('intent')).contentReviewStatus).toBe('not_requested');
  donation = new DonationEntity({ ...original, campaignId: 'another-campaign' });
  expect((await useCase.execute('intent')).contentReviewStatus).toBe('unavailable');
});
