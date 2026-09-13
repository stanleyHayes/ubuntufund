import { describe, it, expect, vi } from 'vitest';
import { CreateDonationIntentUseCase } from '../../../src/application/use-cases/CreateDonationIntentUseCase.js';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import type { PaymentsConfig } from '../../../src/infrastructure/config/index.js';

// Minimal collaborators — only what the paystack create path touches.
function deps(paymentsConfig?: PaymentsConfig) {
  const campaign = {
    goalAmount: new Money(5000, 'GHS'),
    canReceiveDonation: () => true,
  };
  const created: DonationIntentEntity[] = [];
  const donationIntentRepo = {
    findByIdempotencyKey: vi.fn(async (): Promise<DonationIntentEntity | null> => null),
    create: vi.fn(async (intent: DonationIntentEntity) => {
      // echo back with an id, preserving the draft's props
      const withId = new DonationIntentEntity({ ...intent.toPlain(), id: 'intent-1' });
      created.push(withId);
      return withId;
    }),
    updateStatus: vi.fn(async (_id: string, _s: unknown, ref?: string) => {
      const last = created[created.length - 1];
      return new DonationIntentEntity({ ...last.toPlain(), status: 'PENDING', providerRef: ref });
    }),
    findById: vi.fn(),
    findByProviderRef: vi.fn(),
    transitionToSucceeded: vi.fn(),
    recordSettlementFinancials: vi.fn(),
  };
  const paymentGateway = {
    isConfigured: () => true,
    capabilities: vi.fn(),
    initializeTransaction: vi.fn(async () => ({
      authorizationUrl: 'https://pay/x',
      accessCode: 'acc',
      reference: 'uf-intent-1-abcd1234',
    })),
  };
  const paymentAttemptRepo = { record: vi.fn(async () => undefined) };

  const useCase = new CreateDonationIntentUseCase(
    { findById: vi.fn(async () => campaign) } as never,
    { findById: vi.fn() } as never, // liveSessionRepo (unused)
    donationIntentRepo as never,
    {} as never, // feePolicy (unused on create)
    {} as never, // settleDonationUseCase (unused on create)
    paymentGateway as never,
    {} as never, // planLimits (unused on create)
    paymentAttemptRepo as never,
    paymentsConfig
  );
  return { useCase, donationIntentRepo, created };
}

const ctx = { donorUserId: null, idempotencyKey: 'idem-1' };
const baseInput = {
  campaignId: 'c1',
  amount: 10,
  provider: 'paystack' as const,
  donorEmail: 'd@example.com',
};

function paymentsCfg(overrides: Partial<PaymentsConfig> = {}): PaymentsConfig {
  return {
    paystackEnabled: true,
    flutterwaveEnabled: false,
    internationalCardsEnabled: true,
    multiCurrencyEnabled: true,
    defaultProvider: 'paystack',
    reconciliationEnabled: true,
    supportedCurrencies: ['GHS', 'USD', 'GBP', 'EUR', 'CAD'],
    fxSource: 'provider',
    ...overrides,
  };
}

describe('CreateDonationIntentUseCase — currency resolution (spec §11)', () => {
  it('defaults to the campaign currency when none is requested', async () => {
    const { useCase, created } = deps(paymentsCfg());
    await useCase.execute({ ...baseInput }, ctx);
    expect(created[0].currency).toBe('GHS');
    expect(created[0].originalCurrency).toBe('GHS');
    expect(created[0].originalAmountMinor).toBe(1000); // 10 GHS
  });

  it('accepts a supported currency when multi-currency is enabled', async () => {
    const { useCase, created } = deps(paymentsCfg());
    await useCase.execute({ ...baseInput, currency: 'usd', country: 'US', paymentMethod: 'card' }, ctx);
    expect(created[0].currency).toBe('USD');
    expect(created[0].originalCurrency).toBe('USD');
    expect(created[0].originalAmountMinor).toBe(1000); // $10.00
    expect(created[0].country).toBe('US');
    expect(created[0].paymentMethod).toBe('card');
  });

  it('rejects a non-campaign currency when multi-currency is disabled', async () => {
    const { useCase } = deps(paymentsCfg({ multiCurrencyEnabled: false }));
    await expect(useCase.execute({ ...baseInput, currency: 'USD' }, ctx)).rejects.toThrow(
      /USD.*not enabled/
    );
  });

  it('rejects an unsupported currency even when multi-currency is enabled', async () => {
    const { useCase } = deps(paymentsCfg({ supportedCurrencies: ['GHS', 'USD'] }));
    await expect(useCase.execute({ ...baseInput, currency: 'JPY' }, ctx)).rejects.toThrow(
      /JPY.*not supported/
    );
  });

  it('with no payments config, only the campaign currency is allowed (legacy behavior)', async () => {
    const { useCase, created } = deps(undefined);
    await useCase.execute({ ...baseInput }, ctx);
    expect(created[0].currency).toBe('GHS');
    await expect(useCase.execute({ ...baseInput, currency: 'USD' }, ctx)).rejects.toThrow(
      /USD.*not enabled/
    );
  });
});

it('rejects public name-only submissions before reserving a fiat payment and saves accepted terms', async () => {
  const { useCase, donationIntentRepo, created } = deps(paymentsCfg());
  await expect(useCase.execute({ ...baseInput, donorName: 'Public donor' }, ctx)).rejects.toMatchObject({ statusCode: 428 });
  expect(donationIntentRepo.findByIdempotencyKey).not.toHaveBeenCalled();
  expect(donationIntentRepo.create).not.toHaveBeenCalled();
  await useCase.execute({ ...baseInput, donorName: 'Public donor', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } }, ctx);
  expect(created[0].toPlain().messageAgreement?.acceptedAt).toBeInstanceOf(Date);
});

for (const lookup of ['existing', 'creation-race'] as const) {
  it.each(['owner', 'provider'] as const)(`rejects wallet %s mismatch after ${lookup}`, async mismatch => {
    const { useCase, donationIntentRepo } = deps();
    const winner = new DonationIntentEntity({ id: 'winner', campaignId: 'c1', amount: 10, currency: 'GHS', tip: 0,
      provider: mismatch === 'provider' ? 'paystack' : 'wallet', donorUserId: mismatch === 'owner' ? 'other' : 'donor',
      status: 'CREATED', createdAt: new Date(), updatedAt: new Date() });
    if (lookup === 'existing') donationIntentRepo.findByIdempotencyKey.mockResolvedValueOnce(winner);
    else {
      donationIntentRepo.findByIdempotencyKey.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      donationIntentRepo.create.mockRejectedValueOnce(Object.assign(new Error('Duplicate key'), { code: 11000 }));
    }
    await expect(useCase.execute({ campaignId: 'c1', amount: 10, provider: 'wallet' }, { donorUserId: 'donor', idempotencyKey: 'collision' }))
      .rejects.toThrow(mismatch === 'owner' ? 'another account' : 'different payment method');
    expect(donationIntentRepo.transitionToSucceeded).not.toHaveBeenCalled();
  });
}
