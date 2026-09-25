import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoTipRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoTipRepository.js';
import { TipModel } from '../../src/infrastructure/database/models/TipModel.js';
import { CreateTipIntentUseCase } from '../../src/application/use-cases/CreateTipIntentUseCase.js';

beforeAll(async () => { await connectTestDatabase(); await TipModel.init(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('reserves concurrent worker requests in Mongo and replays persisted checkout after worker replacement', async () => {
  const gateway = { initializeCharge: vi.fn(async ({ reference }: { reference: string }) => ({ reference, authorizationUrl: 'https://checkout.paystack.com/fixture', accessCode: 'fixture' })) };
  const worker = () => new CreateTipIntentUseCase(
    { findByHandle: async () => ({ userId: 'creator', handle: 'creator', currency: 'GHS', tipsEnabled: true }) } as never,
    new MongoTipRepository(), { ensure: vi.fn() } as never, gateway as never, { assertCreatorDonations: vi.fn() } as never,
    'test-tip-reference-secret',
  );
  const input = { amount: 25, supporterEmail: 'fixture@example.com', idempotencyKey: 'concurrent-mongo-attempt' };
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => worker().execute('creator', input)));
  expect(results.some(result => result.status === 'fulfilled')).toBe(true);
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
  expect(await TipModel.countDocuments()).toBe(1);
  const saved = await TipModel.findOne();
  expect(saved?.checkout?.checkoutUrl).toBe('https://checkout.paystack.com/fixture');
  expect(await worker().execute('creator', input)).toMatchObject({ reference: saved?.providerRef, tipId: saved?.id });
  await expect(worker().execute('creator', { ...input, amount: 26 })).rejects.toMatchObject({ statusCode: 409 });
  expect(gateway.initializeCharge).toHaveBeenCalledTimes(1);
});

it.each(['SUCCEEDED', 'FAILED'] as const)('clears checkout credentials on %s and rejects late checkout persistence', async status => {
  const repo = new MongoTipRepository();
  const tip = await TipModel.create({ creatorUserId: 'creator', amount: 12, currency: 'GHS', providerRef: `terminal-${status}`, checkout: { checkoutUrl: 'https://private.test', accessCode: 'private' } });
  if (status === 'SUCCEEDED') await repo.transitionToSucceeded(tip.providerRef);
  else await repo.transitionToFailed(tip.providerRef);
  expect(await repo.saveCheckout(tip.providerRef, { checkoutUrl: 'https://late.test', accessCode: 'late' })).toBe(false);
  const stored = await TipModel.findById(tip.id);
  expect(stored?.checkout?.checkoutUrl).toBeUndefined();
  expect(stored?.status).toBe(status);
  expect(stored?.amount).toBe(12);
});
it('does not restore credentials after account erasure revokes checkout', async () => {
  const repo = new MongoTipRepository();
  const tip = await TipModel.create({ creatorUserId: 'creator', amount: 12, currency: 'GHS', providerRef: 'erased-checkout', checkoutRevokedAt: new Date() });
  expect(await repo.saveCheckout(tip.providerRef, { checkoutUrl: 'https://late.test', accessCode: 'late' })).toBe(false);
  expect((await TipModel.findById(tip.id))?.checkout?.checkoutUrl).toBeUndefined();
});
it('returns confirmation if settlement beats the provider initialization response', async () => {
  const repo = new MongoTipRepository();
  const gateway = { initializeCharge: vi.fn(async ({ reference }: { reference: string }) => {
    await repo.transitionToSucceeded(reference);
    return { reference, authorizationUrl: 'https://late-private.test', accessCode: 'late-secret' };
  }) };
  const uc = new CreateTipIntentUseCase(
    { findByHandle: async () => ({ userId: 'creator', handle: 'creator', currency: 'GHS', tipsEnabled: true }) } as never,
    repo, { ensure: vi.fn() } as never, gateway as never, { assertCreatorDonations: vi.fn() } as never,
    'test-tip-reference-secret',
  );
  const result = await uc.execute('creator', { amount: 12, supporterEmail: 'fixture@example.com', idempotencyKey: 'settlement-before-init-response' });
  expect(result.checkoutUrl).toBe(`/tip/callback?reference=${result.reference}`);
  expect(result.accessCode).toBe('');
  expect((await TipModel.findOne({ providerRef: result.reference }))?.checkout?.checkoutUrl).toBeUndefined();
});

it('cleans historical terminal credentials in bounded batches without touching pending payments or finances', async () => {
  const repo = new MongoTipRepository();
  await repo.clearTerminalCheckoutCredentials();
  await TipModel.insertMany(Array.from({ length: 502 }, (_, index) => ({ creatorUserId: 'history', amount: 25, currency: 'GHS', netAmount: 25, providerRef: `historical-${index}`, status: index % 2 ? 'SUCCEEDED' : 'FAILED', checkout: { accessCode: 'historical-secret' } })));
  const pending = await TipModel.create({ creatorUserId: 'history', amount: 30, currency: 'GHS', providerRef: 'historical-pending', status: 'PENDING', checkout: { checkoutUrl: 'https://pending.test', accessCode: 'pending-secret' } });
  expect(await repo.clearTerminalCheckoutCredentials()).toBe(500);
  expect(await repo.clearTerminalCheckoutCredentials()).toBe(2);
  expect(await repo.clearTerminalCheckoutCredentials()).toBe(0);
  expect(await TipModel.countDocuments({ creatorUserId: 'history', status: { $in: ['SUCCEEDED', 'FAILED'] }, amount: 25, netAmount: 25 })).toBe(502);
  expect((await TipModel.findById(pending.id))?.checkout?.accessCode).toBe('pending-secret');
});
