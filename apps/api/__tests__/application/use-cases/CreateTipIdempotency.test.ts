import { expect, it, vi } from 'vitest';
import { CreateTipIntentUseCase } from '../../../src/application/use-cases/CreateTipIntentUseCase.js';
import { TipEntity } from '../../../src/domain/entities/Tip.js';

function setup() {
  const rows = new Map<string, TipEntity>();
  const repo = {
    findByProviderRef: vi.fn(async (ref: string) => rows.get(ref) ?? null),
    create: vi.fn(async (tip: TipEntity) => {
      if (rows.has(tip.providerRef)) throw Object.assign(new Error('duplicate'), { code: 11000 });
      const saved = new TipEntity({ ...tip.toPlain(), id: 'saved-tip' });
      rows.set(tip.providerRef, saved);
      return saved;
    }),
    saveCheckout: vi.fn(async (ref: string, checkout: { checkoutUrl: string; accessCode: string }) => {
      rows.set(ref, new TipEntity({ ...rows.get(ref)!.toPlain(), checkout }));
      return true;
    }),
  };
  const gateway = { initializeCharge: vi.fn(async ({ reference }: { reference: string }) => ({ reference, authorizationUrl: 'https://checkout.paystack.com/test', accessCode: 'secret' })) };
  const uc = new CreateTipIntentUseCase(
    { findByHandle: async () => ({ userId: 'creator', handle: 'creator', tipsEnabled: true, currency: 'GHS' }) } as never,
    repo as never, { ensure: vi.fn() } as never, gateway as never, { assertCreatorDonations: vi.fn() } as never,
  );
  return { uc, gateway, rows };
}
const input = { amount: 25, supporterEmail: 'donor@example.com', idempotencyKey: 'checkout-attempt-123456' };

it('replays saved checkout without initializing a second payment', async () => {
  const { uc, gateway, rows } = setup();
  const first = await uc.execute('creator', input);
  expect(await uc.execute('creator', input)).toEqual(first);
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
  expect(rows.size).toBe(1);
});
it('rejects changed details without exposing the original checkout', async () => {
  const { uc, gateway } = setup();
  await uc.execute('creator', input);
  await expect(uc.execute('creator', { ...input, amount: 30 })).rejects.toMatchObject({ statusCode: 409 });
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
});
it('reserves concurrent attempts before invoking the provider', async () => {
  const { uc, gateway, rows } = setup();
  const results = await Promise.allSettled([uc.execute('creator', input), uc.execute('creator', input)]);
  expect(results.some(result => result.status === 'fulfilled')).toBe(true);
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
  expect(rows.size).toBe(1);
});
it('does not retry an unknown provider outcome automatically', async () => {
  const { uc, gateway } = setup();
  gateway.initializeCharge.mockRejectedValueOnce(new Error('timeout'));
  await expect(uc.execute('creator', input)).rejects.toThrow('timeout');
  const recovery = await uc.execute('creator', input);
  expect(recovery.checkoutUrl).toBe(`/tip/callback?reference=${recovery.reference}`);
  expect(recovery.accessCode).toBe('');
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
});
it('never returns or persists a checkout for a mismatched provider reference', async () => {
  const { uc, gateway, rows } = setup();
  gateway.initializeCharge.mockResolvedValueOnce({ reference: 'wrong', authorizationUrl: 'https://checkout.paystack.com/wrong', accessCode: 'secret' });
  await expect(uc.execute('creator', input)).rejects.toMatchObject({ statusCode: 502 });
  expect([...rows.values()][0].toPlain().checkout).toBeUndefined();
});
it('rejects invalid request keys before contacting the provider', async () => {
  const { uc, gateway } = setup();
  await expect(uc.execute('creator', { ...input, idempotencyKey: 'short' })).rejects.toMatchObject({ statusCode: 400 });
  expect(gateway.initializeCharge).not.toHaveBeenCalled();
});

it.each(['SUCCEEDED', 'FAILED'] as const)('routes a %s retry to confirmation instead of reopening checkout', async status => {
  const { uc, gateway, rows } = setup();
  const first = await uc.execute('creator', input);
  const tip = rows.get(first.reference)!;
  rows.set(first.reference, new TipEntity({ ...tip.toPlain(), status, checkout: undefined }));
  const retry = await uc.execute('creator', input);
  expect(retry.checkoutUrl).toBe(`/tip/callback?reference=${first.reference}`);
  expect(retry.accessCode).toBe('');
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
});
it('requires current terms for a public name even with no message, before reserving payment', async () => {
  const { uc, gateway, rows } = setup();
  await expect(uc.execute('creator', { ...input, supporterName: 'Public alias' })).rejects.toMatchObject({ statusCode: 428 });
  expect(rows.size).toBe(0);
  expect(gateway.initializeCharge).not.toHaveBeenCalled();
  await uc.execute('creator', { ...input, supporterName: 'Public alias', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true } });
  expect([...rows.values()][0].toPlain().messageAgreement).toMatchObject({ acceptedTerms: true, ageConfirmed: true });
});
it('does not require public-content acknowledgement for an anonymous name with no message', async () => {
  const { uc, gateway } = setup();
  await uc.execute('creator', { ...input, supporterName: 'Private name', isAnonymous: true });
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
});
