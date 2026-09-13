import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { MongoDonationIntentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js';
import { ReconcileCryptoUseCase } from '../../src/application/use-cases/ReconcileCryptoUseCase.js';
import type { CryptoPaymentProviderPort } from '../../src/domain/ports/outbound/CryptoPaymentProviderPort.js';
import type { HandleCryptoWebhookUseCase } from '../../src/application/use-cases/HandleCryptoWebhookUseCase.js';

beforeAll(connectTestDatabase);
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
it('rotates failed bounded batches without changing money, status or financial timestamps', async () => {
  const before = new Date(Date.now() - 3600000);
  const rows = await DonationIntentModel.create([0, 1, 2].map(i => ({
    campaignId: 'fairness-fixture', amount: 100, currency: 'GHS', provider: 'mock',
    paymentRail: 'CRYPTO', status: 'PENDING', providerRef: `fairness-${i}`,
    idempotencyKey: randomUUID(), createdAt: before, updatedAt: before,
  })));
  const getDeposit = vi.fn().mockRejectedValue(new Error('Provider unavailable'));
  const applyEvent = vi.fn();
  const repo = new MongoDonationIntentRepository();
  const recovery = new ReconcileCryptoUseCase(repo, new Map([['mock', { getDeposit } as unknown as CryptoPaymentProviderPort]]), { applyEvent } as unknown as HandleCryptoWebhookUseCase);
  for (let i = 0; i < 3; i++) expect(await recovery.reconcileStale({ olderThanMinutes: 1, limit: 1 })).toMatchObject({ scanned: 1, errored: 1, settled: 0 });
  expect(new Set(getDeposit.mock.calls.map(call => call[0])).size).toBe(3);
  expect(applyEvent).not.toHaveBeenCalled();
  for (const row of rows) {
    const saved = await DonationIntentModel.findById(row.id);
    expect(saved).toMatchObject({ amount: 100, status: 'PENDING', updatedAt: before });
    expect(saved!.cryptoReconciledAt).toBeInstanceOf(Date);
  }
  await recovery.reconcileStale({ olderThanMinutes: 1, limit: 1 });
  expect(getDeposit).toHaveBeenCalledTimes(4);
  expect(getDeposit.mock.calls[3][0]).toBe(getDeposit.mock.calls[0][0]);
  await DonationIntentModel.updateOne({ _id: rows[0].id }, { $set: { status: 'SUCCEEDED' } });
  expect(await repo.recordCryptoReconciliationAttempt(rows[0].id, new Date())).toBe(false);
});
