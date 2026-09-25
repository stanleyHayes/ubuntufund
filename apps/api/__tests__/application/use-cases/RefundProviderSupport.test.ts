import { describe, expect, it, vi } from 'vitest';
import { ProcessRefundUseCase } from '../../../src/application/use-cases/ProcessRefundUseCase.js';
import { DonationIntentEntity } from '../../../src/domain/entities/DonationIntent.js';

// I126: a Flutterwave refund used to reserve the claim and a funds hold, then
// fail at the provider (501) into provider_unknown, freezing the campaign's
// pending funds with nothing to release them.
describe('refunds on a provider that cannot confirm them', () => {
  it('is refused before any claim or funds hold', async () => {
    const intent = new DonationIntentEntity({
      id: 'intent-1', campaignId: 'c', amount: 100, tip: 0, currency: 'GHS', status: 'SUCCEEDED',
      provider: 'flutterwave', providerRef: 'uf-intent-1-abcd1234', donorUserId: null, isAnonymous: false,
      idempotencyKey: 'k', createdAt: new Date(), updatedAt: new Date(),
    });
    const intents = { findById: vi.fn(async () => intent), claimRefund: vi.fn() };
    const operations = { create: vi.fn(), findActiveByIntentId: vi.fn() };
    const funds = { reserve: vi.fn() };
    const unitOfWork = { run: vi.fn(async (work: () => Promise<unknown>) => work()) };
    const gateway = { isConfigured: () => true, refundPayment: vi.fn() };
    const uc = new ProcessRefundUseCase(
      intents as never, {} as never, {} as never, {} as never,
      new Map([['flutterwave', gateway]]) as never, operations as never, unitOfWork as never, funds as never,
    );
    await expect(uc.execute('intent-1', {} as never, 'admin')).rejects.toMatchObject({ statusCode: 501 });
    expect(intents.claimRefund).not.toHaveBeenCalled();
    expect(operations.create).not.toHaveBeenCalled();
    expect(funds.reserve).not.toHaveBeenCalled();
    expect(unitOfWork.run).not.toHaveBeenCalled();
    expect(gateway.refundPayment).not.toHaveBeenCalled();
  });
});
