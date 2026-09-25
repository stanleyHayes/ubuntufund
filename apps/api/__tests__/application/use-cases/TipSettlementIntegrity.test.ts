import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { HandleTipWebhookUseCase } from '../../../src/application/use-cases/HandleTipWebhookUseCase.js';
import { CreateTipIntentUseCase } from '../../../src/application/use-cases/CreateTipIntentUseCase.js';
import {
  ABANDONED_CHECKOUT_TTL_MS,
  ReconcilePaymentsUseCase,
} from '../../../src/application/use-cases/ReconcilePaymentsUseCase.js';
import { TipEntity } from '../../../src/domain/entities/Tip.js';
import type { DonationIntentStatus } from '@ubuntu-fund/types';

const REF = 'tip-reference-under-test';

/** In-memory tip repo that models the atomic status gates of MongoTipRepository. */
function tipStore(status: DonationIntentStatus = 'PENDING', amount = 500, createdAt = new Date()) {
  let row = new TipEntity({
    id: 'tip-1', creatorUserId: 'creator', amount, currency: 'GHS', isAnonymous: false,
    status, provider: 'paystack', providerRef: REF, platformFee: 0, netAmount: amount,
    settlementApplied: false, createdAt, updatedAt: createdAt,
  });
  const set = (next: DonationIntentStatus) => {
    row = new TipEntity({ ...row.toPlain(), status: next });
    return row;
  };
  const repo = {
    findByProviderRef: vi.fn(async (ref: string) => (ref === REF ? row : null)),
    transitionToSucceeded: vi.fn(async (_ref: string, opts: { allowFromFailed?: boolean } = {}) => {
      const from = opts.allowFromFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
      return from.includes(row.status) ? set('SUCCEEDED') : null;
    }),
    transitionToFailed: vi.fn(async () => (row.status === 'PENDING' ? set('FAILED') : null)),
    markSettlementApplied: vi.fn(async () => { row = new TipEntity({ ...row.toPlain(), settlementApplied: true }); }),
    findStalePending: vi.fn(async () => (row.status === 'PENDING' ? [row] : [])),
    findSucceededUnsettled: vi.fn(async () => []),
    recordReconciliationAttempt: vi.fn(async () => undefined),
  };
  const credited: number[] = [];
  const refs = new Set<string>();
  const balance = {
    ensure: vi.fn(async () => ({})),
    creditTip: vi.fn(async (_u: string, gross: number, _f: number, _n: number, settleRef: string) => {
      if (refs.has(settleRef)) return null;
      refs.add(settleRef);
      credited.push(gross);
      return {};
    }),
  };
  return { repo, balance, credited, status: () => row.status };
}

describe('tip webhook settlement checks the charged amount (I042)', () => {
  it('credits a matching charge exactly once, however often it is replayed', async () => {
    const { repo, balance, credited, status } = tipStore();
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    await Promise.all([uc.handleSuccess(REF, { amount: 500, currency: 'GHS' }), uc.handleSuccess(REF, { amount: 500, currency: 'GHS' })]);
    expect(status()).toBe('SUCCEEDED');
    expect(credited).toEqual([500]);
  });

  it.each([
    { amount: 1, currency: 'GHS' },
    { amount: 499.99, currency: 'GHS' },
    { amount: 500, currency: 'USD' },
    { amount: 500, currency: '' },
    { amount: Number.NaN, currency: 'GHS' },
  ])('never credits a charge that differs from the tip: %j', async charge => {
    const { repo, balance, credited, status } = tipStore();
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never);
    await uc.handleSuccess(REF, charge);
    expect(status()).toBe('PENDING');
    expect(credited).toEqual([]);
    expect(repo.transitionToSucceeded).not.toHaveBeenCalled();
  });

  it('credits a late success on a FAILED tip only after the provider confirms it', async () => {
    const { repo, balance, credited, status } = tipStore('FAILED');
    const gateway = { verifyTransaction: vi.fn(async () => ({ status: 'success', reference: REF, amount: 500, currency: 'GHS', fees: 0, raw: {} })) };
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never, gateway);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(gateway.verifyTransaction).toHaveBeenCalledWith(REF);
    expect(status()).toBe('SUCCEEDED');
    expect(credited).toEqual([500]);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(credited).toEqual([500]);
  });

  it.each([
    { status: 'failed', reference: REF, amount: 500, currency: 'GHS' },
    { status: 'success', reference: REF, amount: 5, currency: 'GHS' },
    { status: 'success', reference: 'tip-other', amount: 500, currency: 'GHS' },
  ])('leaves a FAILED tip uncredited when verification disagrees: %j', async verified => {
    const { repo, balance, credited, status } = tipStore('FAILED');
    const gateway = { verifyTransaction: vi.fn(async () => ({ fees: 0, raw: {}, ...verified })) };
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never, gateway);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(status()).toBe('FAILED');
    expect(credited).toEqual([]);
  });

  // R2-002: a failure written between the read and the transition must not
  // swallow a paid charge.
  it('credits a success that raced a concurrent PENDING → FAILED write, after verification', async () => {
    const { repo, balance, credited, status } = tipStore('PENDING');
    const gateway = { verifyTransaction: vi.fn(async () => ({ status: 'success', reference: REF, amount: 500, currency: 'GHS', fees: 0, raw: {} })) };
    const transition = repo.transitionToSucceeded.getMockImplementation()!;
    repo.transitionToSucceeded.mockImplementationOnce(async (ref, opts) => {
      await repo.transitionToFailed(); // charge.failed / the sweep lands first
      return transition(ref, opts);
    });
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never, gateway);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(gateway.verifyTransaction).toHaveBeenCalledWith(REF);
    expect(status()).toBe('SUCCEEDED');
    expect(credited).toEqual([500]);
  });

  it('leaves a raced tip FAILED when the provider does not confirm the success', async () => {
    const { repo, balance, credited, status } = tipStore('PENDING');
    const gateway = { verifyTransaction: vi.fn(async () => ({ status: 'failed', reference: REF, amount: 500, currency: 'GHS', fees: 0, raw: {} })) };
    const transition = repo.transitionToSucceeded.getMockImplementation()!;
    repo.transitionToSucceeded.mockImplementationOnce(async (ref, opts) => {
      await repo.transitionToFailed();
      return transition(ref, opts);
    });
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never, gateway);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(status()).toBe('FAILED');
    expect(credited).toEqual([]);
  });

  it('asks for a redelivery when a raced tip cannot be verified here', async () => {
    const { repo, balance, credited } = tipStore('PENDING');
    const transition = repo.transitionToSucceeded.getMockImplementation()!;
    repo.transitionToSucceeded.mockImplementationOnce(async (ref, opts) => {
      await repo.transitionToFailed();
      return transition(ref, opts);
    });
    const gateway = { verifyTransaction: vi.fn(async () => { throw new Error('provider timeout'); }) };
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never, gateway);
    await expect(uc.handleSuccess(REF, { amount: 500, currency: 'GHS' })).rejects.toThrow('provider timeout');
    expect(credited).toEqual([]);
  });

  it('does not revive a FAILED tip without a way to verify it', async () => {
    const { repo, balance, credited, status } = tipStore('FAILED');
    const uc = new HandleTipWebhookUseCase(repo as never, balance as never);
    await uc.handleSuccess(REF, { amount: 500, currency: 'GHS' });
    expect(status()).toBe('FAILED');
    expect(credited).toEqual([]);
  });
});

describe('tip references cannot be predicted (I042)', () => {
  function setup(secret: string) {
    const refs: string[] = [];
    const tips = {
      findByProviderRef: vi.fn(async () => null),
      create: vi.fn(async (tip: TipEntity) => { refs.push(tip.providerRef); return new TipEntity({ ...tip.toPlain(), id: 'tip' }); }),
      saveCheckout: vi.fn(async () => true),
    };
    const gateway = { initializeCharge: vi.fn(async ({ reference }: { reference: string }) => ({ reference, authorizationUrl: 'https://checkout.paystack.com/x', accessCode: 'x' })) };
    const uc = new CreateTipIntentUseCase(
      { findByHandle: async () => ({ userId: 'creator-user-id', handle: 'creator', tipsEnabled: true, currency: 'GHS' }) } as never,
      tips as never, { ensure: vi.fn() } as never, gateway as never, { assertCreatorDonations: vi.fn() } as never, secret,
    );
    return { uc, refs };
  }
  const input = { amount: 25, supporterEmail: 'donor@example.com', idempotencyKey: 'checkout-attempt-123456' };

  it('is stable for the same request on the server but differs from an unkeyed digest', async () => {
    const a = setup('server-secret-one-0123456789abcdef');
    await a.uc.execute('creator', input);
    await a.uc.execute('creator', input);
    expect(a.refs[0]).toBe(a.refs[1]);
    const unkeyed = `tip-${createHash('sha256').update(JSON.stringify(['creator-user-id', 'guest', input.idempotencyKey])).digest('hex')}`;
    expect(a.refs[0]).not.toBe(unkeyed);
    const b = setup('server-secret-two-0123456789abcdef');
    await b.uc.execute('creator', input);
    expect(b.refs[0]).not.toBe(a.refs[0]);
  });

  it('refuses to run without a reference secret', () => {
    expect(() => setup('')).toThrow(/secret/);
  });
});

describe('stale PENDING tips are reconciled with the provider (I042)', () => {
  function reconciler(verify: Record<string, unknown>, status: DonationIntentStatus = 'PENDING', createdAt = new Date()) {
    const store = tipStore(status, 500, createdAt);
    const gateway = {
      isConfigured: () => true,
      verifyTransaction: vi.fn(async () => ({ reference: REF, amount: 500, currency: 'GHS', fees: 0, raw: {}, ...verify })),
    };
    const settlement = new HandleTipWebhookUseCase(store.repo as never, store.balance as never, gateway);
    const intents = { findStalePending: vi.fn(async () => []) };
    const uc = new ReconcilePaymentsUseCase(
      new Map([['paystack', gateway]]) as never, intents as never, { record: vi.fn() } as never,
      {} as never, {} as never, {} as never, store.repo as never, settlement,
    );
    return { uc, store, gateway };
  }

  it('settles a paid tip whose webhook was lost, exactly once', async () => {
    const { uc, store } = reconciler({ status: 'success' });
    const first = await uc.reconcileStale();
    await uc.reconcileStale();
    expect(first.tipsSettled).toBe(1);
    expect(store.status()).toBe('SUCCEEDED');
    expect(store.credited).toEqual([500]);
    expect(store.repo.recordReconciliationAttempt).toHaveBeenCalled();
  });

  it('never credits a provider amount that differs from the tip', async () => {
    const { uc, store } = reconciler({ status: 'success', amount: 1 });
    const summary = await uc.reconcileStale();
    expect(summary.tipsSettled).toBe(0);
    expect(store.status()).toBe('PENDING');
    expect(store.credited).toEqual([]);
  });

  it('fails a tip the provider reports as failed', async () => {
    const { uc, store } = reconciler({ status: 'failed' });
    expect((await uc.reconcileStale()).tipsFailed).toBe(1);
    expect(store.status()).toBe('FAILED');
  });

  it('keeps a recently abandoned checkout open, and closes one past the TTL', async () => {
    const young = reconciler({ status: 'abandoned' });
    expect((await young.uc.reconcileStale()).tipsFailed).toBe(0);
    expect(young.store.status()).toBe('PENDING');

    const old = reconciler({ status: 'abandoned' }, 'PENDING', new Date(Date.now() - ABANDONED_CHECKOUT_TTL_MS - 60_000));
    expect((await old.uc.reconcileStale()).tipsFailed).toBe(1);
    expect(old.store.status()).toBe('FAILED');
  });

  it('closes a tip whose reference the provider never registered, only past the TTL', async () => {
    const { ProviderTransactionNotFoundError } = await import('../../../src/domain/errors/ProviderTransactionNotFoundError.js');
    const young = reconciler({ status: 'success' });
    young.gateway.verifyTransaction.mockRejectedValue(new ProviderTransactionNotFoundError(REF));
    await young.uc.reconcileStale();
    expect(young.store.status()).toBe('PENDING');
    const old = reconciler({ status: 'success' }, 'PENDING', new Date(Date.now() - ABANDONED_CHECKOUT_TTL_MS - 60_000));
    old.gateway.verifyTransaction.mockRejectedValue(new ProviderTransactionNotFoundError(REF));
    expect((await old.uc.reconcileStale()).tipsFailed).toBe(1);
    expect(old.store.status()).toBe('FAILED');
  });

  it('leaves a tip PENDING on a transient provider error', async () => {
    const { uc, store, gateway } = reconciler({ status: 'success' });
    gateway.verifyTransaction.mockRejectedValueOnce(new Error('timeout'));
    await uc.reconcileStale();
    expect(store.status()).toBe('PENDING');
    expect(store.repo.recordReconciliationAttempt).toHaveBeenCalledTimes(1);
  });
});
