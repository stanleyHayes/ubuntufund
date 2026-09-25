import { expect, it, vi } from 'vitest';
import { GetProfileUseCase } from '../../../src/application/use-cases/GetProfileUseCase.js';
import { DonationEntity } from '../../../src/domain/entities/Donation.js';
import { Money } from '../../../src/domain/value-objects/Money.js';

const donation = (id: string, amount: number, currency: string) => new DonationEntity({
  id, campaignId: `campaign-${id}`, donorId: 'donor', amount: new Money(amount, currency), paymentMethod: 'wallet' as never, isAnonymous: false, createdAt: new Date('2026-09-01T00:00:00Z'),
});
const user = { toPlain: () => ({ id: 'donor', email: { value: 'ama@example.test' }, name: 'Ama', role: 'user', verificationLevel: 0, trustScore: { value: 50 }, createdAt: new Date(), updatedAt: new Date() }) };
const campaign = (amount: number, currency: string) => ({ raisedAmount: new Money(amount, currency), title: 'Campaign', category: 'education' });

function setup(refunds: { donationId: string; status: string }[]) {
  const donations = [donation('d1', 100, 'GHS'), donation('d2', 50.5, 'GHS'), donation('d3', 20, 'USD'), donation('d4', 10, 'USD')];
  const refundRepo = { findByDonationIds: vi.fn(async () => refunds) };
  const uc = new GetProfileUseCase(
    { findById: async () => user } as never,
    { findByUserId: async () => null } as never,
    { findByDonorId: async () => donations } as never,
    { countByCreatorId: async () => 3, findByCreatorId: async () => [campaign(300, 'GHS'), campaign(0, 'GHS'), campaign(40, 'USD'), campaign(25.25, 'GHS')], findById: async () => null } as never,
    refundRepo as never,
  );
  return { uc, refundRepo };
}

it('reports donated totals per currency net of completed refunds, never summing currencies', async () => {
  const { uc, refundRepo } = setup([{ donationId: 'd2', status: 'completed' }, { donationId: 'd4', status: 'pending' }]);
  const profile = await uc.execute('donor');
  expect(refundRepo.findByDonationIds).toHaveBeenCalledWith(['d1', 'd2', 'd3', 'd4']);
  expect(profile.donatedByCurrency).toEqual([
    { currency: 'GHS', gross: 150.5, refunded: 50.5, net: 100 },
    { currency: 'USD', gross: 30, refunded: 0, net: 30 },
  ]);
  // Legacy field for older apps that label it GH₵: GHS net only.
  expect(profile.totalDonated).toBe(100);
  expect(profile.raisedByCurrency).toEqual([{ currency: 'GHS', raised: 325.25 }, { currency: 'USD', raised: 40 }]);
  expect(profile.campaignsCreated).toBe(3);
  expect(profile.donationCount).toBe(4);
});

it('no longer returns hard-coded placeholder stats', async () => {
  const profile = await setup([]).uc.execute('donor') as unknown as Record<string, unknown>;
  for (const field of ['streak', 'rank', 'followers', 'following', 'bookmarks', 'badges', 'interestedCategories']) expect(profile).not.toHaveProperty(field);
});
