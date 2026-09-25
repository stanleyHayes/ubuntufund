import { expect, it, vi } from 'vitest';
import { PaymentMethod } from '@ubuntu-fund/types';
import { DonateToCampaignUseCase } from '../../../src/application/use-cases/DonateToCampaignUseCase.js';
import type { CreateDonationIntentUseCase } from '../../../src/application/use-cases/CreateDonationIntentUseCase.js';
it.each([false, true])('preserves the wallet anonymity choice (%s) and only forwards a public name when chosen', async isAnonymous => {
  const execute = vi.fn().mockResolvedValue({ intent: { status: 'SUCCEEDED', campaignId: 'campaign', amount: 10, currency: 'GHS' } });
  const useCase = new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase);
  const legalAcceptance = { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true };
  await useCase.execute({ campaignId: 'campaign', amount: 10, currency: 'GHS', paymentMethod: PaymentMethod.WALLET, donorName: '  Chosen name  ', isAnonymous, legalAcceptance }, 'donor');
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ donorName: isAnonymous ? undefined : 'Chosen name', isAnonymous, legalAcceptance }), expect.objectContaining({ donorUserId: 'donor' }));
});

// I006: a retry after a lost response must reuse the same intent, not debit twice.
const walletInput = { campaignId: 'campaign', amount: 10, currency: 'GHS', paymentMethod: PaymentMethod.WALLET, isAnonymous: true };
it('scopes the client request key to the donor', async () => {
  const execute = vi.fn().mockResolvedValue({ intent: { status: 'SUCCEEDED', campaignId: 'campaign', amount: 10, currency: 'GHS' } });
  await new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase).execute(walletInput, 'donor', 'attempt-0123456789');
  expect(execute).toHaveBeenCalledWith(expect.anything(), { donorUserId: 'donor', idempotencyKey: 'legacy-wallet:donor:attempt-0123456789' });
});
it('rejects a malformed request key before touching the wallet', async () => {
  const execute = vi.fn();
  await expect(new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase).execute(walletInput, 'donor', 'bad key!')).rejects.toMatchObject({ statusCode: 400 });
  expect(execute).not.toHaveBeenCalled();
});
it('never reports a replayed failed attempt as a successful donation', async () => {
  const execute = vi.fn().mockResolvedValue({ intent: { status: 'FAILED', campaignId: 'campaign', amount: 10, currency: 'GHS' } });
  await expect(new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase).execute(walletInput, 'donor', 'attempt-0123456789')).rejects.toMatchObject({ statusCode: 409 });
});
it('refuses to report a reused key as a different donation', async () => {
  const execute = vi.fn().mockResolvedValue({ intent: { status: 'SUCCEEDED', campaignId: 'campaign', amount: 300, currency: 'GHS' } });
  await expect(new DonateToCampaignUseCase({ execute } as unknown as CreateDonationIntentUseCase).execute(walletInput, 'donor', 'attempt-0123456789')).rejects.toMatchObject({ statusCode: 409 });
});
