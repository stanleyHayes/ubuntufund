import { describe, expect, it, vi } from 'vitest';
import { HandlePaystackWebhookUseCase } from '../../../src/application/use-cases/HandlePaystackWebhookUseCase.js';

type Deps = Partial<{
  gateway: Record<string, unknown>;
  intents: Record<string, unknown>;
  attempts: Record<string, unknown>;
  settle: Record<string, unknown>;
  planLimits: Record<string, unknown>;
  checkouts: Record<string, unknown>;
  settleSubscription: Record<string, unknown>;
  tips: Record<string, unknown>;
}>;

/** Builds the webhook use case with only the collaborators a test cares about. */
function webhook(deps: Deps = {}) {
  const gateway = { isConfigured: () => true, verifyWebhookSignature: () => true, ...deps.gateway };
  const uc = new HandlePaystackWebhookUseCase(
    gateway as never,
    (deps.intents ?? {}) as never,
    (deps.attempts ?? { record: vi.fn() }) as never,
    { computeSettlementFromProvider: vi.fn((x: unknown) => x) } as never,
    (deps.settle ?? {}) as never,
    (deps.planLimits ?? { platformFeePercentForIntent: vi.fn(async () => 0) }) as never,
    {} as never,
    (deps.checkouts ?? {}) as never,
    (deps.settleSubscription ?? {}) as never,
    {} as never,
    undefined,
    undefined,
    deps.tips as never,
  );
  const send = (event: string, data: Record<string, unknown>) =>
    uc.execute({ rawBody: Buffer.from(JSON.stringify({ event, data })), signature: 'sig' });
  return { uc, send };
}

describe('subscription charge.success checks the charged amount (I042)', () => {
  const checkout = { id: 'chk-1', providerRef: 'sub-abc12345', finalAmount: 120, currency: 'GHS', status: 'pending' };

  it('activates when Paystack charged the quoted total', async () => {
    const settleSubscription = { execute: vi.fn() };
    const { send } = webhook({ checkouts: { findByProviderRef: vi.fn(async () => checkout) }, settleSubscription });
    await send('charge.success', { reference: checkout.providerRef, amount: 12000, currency: 'GHS' });
    expect(settleSubscription.execute).toHaveBeenCalledWith(checkout, checkout.providerRef);
  });

  it.each([
    { amount: 100, currency: 'GHS' },
    { amount: 12000, currency: 'USD' },
    { amount: 12000 },
    { currency: 'GHS' },
  ])('does not activate on a mismatched charge: %j', async charge => {
    const settleSubscription = { execute: vi.fn() };
    const { send } = webhook({ checkouts: { findByProviderRef: vi.fn(async () => checkout) }, settleSubscription });
    await send('charge.success', { reference: checkout.providerRef, ...charge });
    expect(settleSubscription.execute).not.toHaveBeenCalled();
  });
});

describe('tip charge.success forwards what Paystack charged (I042)', () => {
  it('passes the charged major-unit amount and currency to the tip settlement', async () => {
    const tips = { handleSuccess: vi.fn() };
    const { send } = webhook({ tips });
    await send('charge.success', { reference: 'tip-abc', amount: 5000, currency: 'GHS' });
    expect(tips.handleSuccess).toHaveBeenCalledWith('tip-abc', { amount: 50, currency: 'GHS' });
  });

  it('fails closed when the charge carries no usable amount', async () => {
    const tips = { handleSuccess: vi.fn() };
    const { send } = webhook({ tips });
    await send('charge.success', { reference: 'tip-abc', currency: 'GHS' });
    const [, charge] = tips.handleSuccess.mock.calls[0] as [string, { amount: number }];
    expect(Number.isNaN(charge.amount)).toBe(true);
  });
});
