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
    findByIdempotencyKey: vi.fn(async () => null),
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
    {} as never, // walletRepo (unused on paystack path)
    donationIntentRepo as never,
    {} as never, // feePolicy (unused on create)
    {} as never, // settleDonationUseCase (unused on create)
    paymentGateway as never,
    {} as never, // planLimits (unused on create)
    undefined,
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
