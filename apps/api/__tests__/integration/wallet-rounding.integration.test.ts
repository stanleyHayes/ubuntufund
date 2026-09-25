import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoWalletRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { Money } from '../../src/domain/value-objects/Money.js';

beforeAll(async () => { await connectTestDatabase(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

// I124: an unrounded float $inc left 10.00 - 9.99 = 0.009999…, displayed as
// GH₵0.01 but too small to spend GH₵0.01.
describe('wallet debits keep balances at currency precision', () => {
  const repo = new MongoWalletRepository();
  async function wallet(balance: number, currency = 'GHS') {
    const userId = randomUUID();
    const doc = await WalletModel.create({ userId, type: 'local', balance, currency });
    return { id: doc.id as string, userId };
  }

  it('10.00 - 9.99 leaves exactly 0.01, which can then be spent in full', async () => {
    const w = await wallet(10);
    expect((await repo.withdrawIfSufficient(w.id, w.userId, new Money(9.99, 'GHS')))?.balance.amount).toBe(0.01);
    expect((await WalletModel.findById(w.id))?.balance).toBe(0.01);
    expect(await repo.withdrawIfSufficient(w.id, w.userId, new Money(0.02, 'GHS'))).toBeNull();
    expect((await repo.withdrawIfSufficient(w.id, w.userId, new Money(0.01, 'GHS')))?.balance.amount).toBe(0);
    expect(await repo.withdrawIfSufficient(w.id, w.userId, new Money(0.01, 'GHS'))).toBeNull();
  });

  it('spends a legacy balance carrying float residue down to its displayed value', async () => {
    const w = await wallet(8.379999999999999);
    expect((await repo.withdrawIfSufficient(w.id, w.userId, new Money(8.38, 'GHS')))?.balance.amount).toBe(0);
  });

  it('never overdraws and keeps concurrent debits exact', async () => {
    const w = await wallet(1);
    const results = await Promise.all(Array.from({ length: 12 }, () => repo.withdrawIfSufficient(w.id, w.userId, new Money(0.1, 'GHS'))));
    expect(results.filter(Boolean)).toHaveLength(10);
    expect((await WalletModel.findById(w.id))?.balance).toBe(0);
  });

  it('rounds deposits the same way', async () => {
    const w = await wallet(0.1);
    expect((await repo.depositAtomic(w.id, w.userId, new Money(0.2, 'GHS')))?.balance.amount).toBe(0.3);
  });
});
