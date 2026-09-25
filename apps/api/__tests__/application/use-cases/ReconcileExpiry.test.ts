import { describe, expect, it, vi } from 'vitest';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';
import {
  ABANDONED_CHECKOUT_TTL_MS,
  MAX_RECONCILE_LIMIT,
  ReconcilePaymentsUseCase,
} from '../../../src/application/use-cases/ReconcilePaymentsUseCase.js';
import { ProviderTransactionNotFoundError } from '../../../src/domain/errors/ProviderTransactionNotFoundError.js';

const REF = 'uf-intent-1-abcd1234';

function intent(ageMs: number, couponId?: string) {
  const createdAt = new Date(Date.now() - ageMs);
  return new DonationIntentEntity({
    id: 'intent-1', campaignId: 'c', amount: 100, tip: 0, currency: 'GHS', status: 'PENDING',
    provider: 'paystack', providerRef: REF, donorUserId: 'donor', isAnonymous: false,
    idempotencyKey: 'k', couponId, createdAt, updatedAt: createdAt,
  });
}

function setup(row: DonationIntentEntity, verify: () => Promise<unknown>) {
  const repo = {
    findStalePending: vi.fn(async () => [row]),
    recordReconciliationAttempt: vi.fn(async () => undefined),
    markExpiredIfPending: vi.fn(async () => row),
    markFailedIfPending: vi.fn(async () => row),
    findById: vi.fn(async () => row),
  };
  const seats = {
    findByProviderRef: vi.fn(async () => ({ id: 'seat-1' })),
    markReleased: vi.fn(async () => null),
  };
  const gateway = { isConfigured: () => true, verifyTransaction: vi.fn(verify) };
  const uc = new ReconcilePaymentsUseCase(
    new Map([['paystack', gateway]]) as never, repo as never, { record: vi.fn() } as never,
    {} as never, {} as never, {} as never, undefined, undefined, seats as never,
  );
  return { uc, repo, seats };
}

describe('abandoned hosted checkouts expire (I038, I007)', () => {
  const abandoned = async () => ({ status: 'abandoned', reference: REF, amount: 100, fees: 0, currency: 'GHS', raw: {} });

  it('expires an abandoned checkout past the TTL and frees its fee-waiver seat', async () => {
    const { uc, repo, seats } = setup(intent(ABANDONED_CHECKOUT_TTL_MS + 60_000, 'coupon-1'), abandoned);
    const summary = await uc.reconcileStale();
    expect(summary.expired).toBe(1);
    expect(repo.markExpiredIfPending).toHaveBeenCalledWith('intent-1', REF);
    expect(seats.markReleased).toHaveBeenCalledWith('seat-1');
  });

  it('keeps a young abandoned checkout open but stamps the visit so the queue rotates', async () => {
    const { uc, repo } = setup(intent(60 * 60_000), abandoned);
    const summary = await uc.reconcileStale();
    expect(summary.pending).toBe(1);
    expect(repo.markExpiredIfPending).not.toHaveBeenCalled();
    expect(repo.recordReconciliationAttempt).toHaveBeenCalledWith('intent-1', expect.any(Date));
  });

  it('expires a reference the provider has never heard of, only past the TTL', async () => {
    const notFound = async () => { throw new ProviderTransactionNotFoundError(REF); };
    const old = setup(intent(ABANDONED_CHECKOUT_TTL_MS + 60_000), notFound);
    expect((await old.uc.reconcileStale()).expired).toBe(1);
    const young = setup(intent(60_000), notFound);
    expect((await young.uc.reconcileStale()).pending).toBe(1);
    expect(young.repo.markExpiredIfPending).not.toHaveBeenCalled();
  });

  it('treats any other verification error as transient', async () => {
    const { uc, repo } = setup(intent(ABANDONED_CHECKOUT_TTL_MS + 60_000), async () => { throw new Error('502'); });
    expect((await uc.reconcileStale()).pending).toBe(1);
    expect(repo.markExpiredIfPending).not.toHaveBeenCalled();
  });

  it('caps an admin-requested batch size', async () => {
    const { uc, repo } = setup(intent(60_000), abandoned);
    await uc.reconcileStale({ limit: 1_000_000 });
    expect(repo.findStalePending).toHaveBeenCalledWith(expect.any(Date), MAX_RECONCILE_LIMIT);
    await uc.reconcileStale({ limit: 0 });
    expect(repo.findStalePending).toHaveBeenLastCalledWith(expect.any(Date), 1);
  });
});
