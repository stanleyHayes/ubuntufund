import { expect, it, vi } from 'vitest';
import { PaymentMethod } from '@ubuntu-fund/types';
import { DonateToCampaignUseCase } from '../../../src/application/use-cases/DonateToCampaignUseCase.js';
import type { CreateDonationIntentUseCase } from '../../../src/application/use-cases/CreateDonationIntentUseCase.js';
it.each([false, true])('preserves the wallet anonymity choice (%s) and only forwards a public name when chosen', async isAnonymous => {
  const execute = vi.fn().mockResolvedValue({});
  const useCase = new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase);
  const legalAcceptance = { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true };
  await useCase.execute({ campaignId: 'campaign', amount: 10, currency: 'GHS', paymentMethod: PaymentMethod.WALLET, donorName: '  Chosen name  ', isAnonymous, legalAcceptance }, 'donor');
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ donorName: isAnonymous ? undefined : 'Chosen name', isAnonymous, legalAcceptance }), expect.objectContaining({ donorUserId: 'donor' }));
});
