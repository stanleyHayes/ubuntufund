import { describe, it, beforeAll, afterAll, beforeEach, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { WalletTopUpService } from '../../src/infrastructure/adapters/outbound/payments/WalletTopUpService.js';
import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { WalletTopUpModel } from '../../src/infrastructure/database/models/WalletTopUpModel.js';
import { WalletTransactionModel } from '../../src/infrastructure/database/models/WalletTransactionModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { JournalLineModel } from '../../src/infrastructure/database/models/JournalLineModel.js';
import { LedgerAccountModel } from '../../src/infrastructure/database/models/LedgerAccountModel.js';
import type { PaymentGatewayPort } from '../../src/domain/ports/outbound/PaymentGatewayPort.js';
import { AccountDeletionRequestModel } from '../../src/infrastructure/database/models/AccountDeletionRequestModel.js';

beforeAll(async () => { await connectTestDatabase(); await Promise.all([WalletTopUpModel.init(), WalletModel.init(), JournalEntryModel.init(), JournalLineModel.init(), LedgerAccountModel.init(), WalletTransactionModel.init()]); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
let userId: string, walletId: string;
let verifiedStatus = 'success', amount = 100, currency = 'GHS';
const init = vi.fn(async (p: { reference: string }) => ({ reference: p.reference, authorizationUrl: 'https://checkout.paystack.com/test', accessCode: 'test' }));
const gateway = { isConfigured: () => true, initializeCharge: init, verifyTransaction: async (reference: string) => ({ reference, amount, currency, fees: 1.5, status: verifiedStatus, raw: {} }) } as unknown as PaymentGatewayPort;
const service = new WalletTopUpService(gateway, true);
beforeEach(async () => {
  amount = 100; currency = 'GHS'; verifiedStatus = 'success'; init.mockClear();
  const user = await UserModel.create({ name: 'Test', email: `${randomUUID()}@example.test`, passwordHash: 'unused', country: 'Ghana' }); userId = user.id;
  const wallet = await WalletModel.create({ userId, type: 'local', balance: 0, currency: 'GHS' }); walletId = wallet.id;
});
describe('verified wallet top-ups', () => {
  it('reuses checkout and credits once across concurrent callback/webhook retries, with balanced ledger', async () => {
    const key = randomUUID();
    const first = await service.initialize(userId, walletId, 100, key);
    expect(await service.initialize(userId, walletId, 100, key)).toEqual(first);
    expect(init).toHaveBeenCalledTimes(1);
    expect((await WalletModel.findById(walletId))!.balance).toBe(0);
    await Promise.all([service.settle(first.reference), service.status(userId, first.reference), service.settle(first.reference)]);
    expect((await WalletModel.findById(walletId))!.balance).toBe(100);
    expect(await WalletTransactionModel.countDocuments({ reference: first.reference })).toBe(1);
    const entries = await JournalEntryModel.find({ externalRef: first.reference }); expect(entries).toHaveLength(1);
    const lines = await JournalLineModel.find({ journalEntryId: entries[0].id });
    expect(lines.filter(l => l.direction === 'debit').reduce((sum, l) => sum + l.amount, 0)).toBe(100);
    expect(lines.filter(l => l.direction === 'credit').reduce((sum, l) => sum + l.amount, 0)).toBe(100);
  });
  it('rejects foreign wallet/status access, reused keys, excessive precision and unverified money', async () => {
    await expect(service.initialize(userId, new (await import('mongoose')).Types.ObjectId().toString(), 100, randomUUID())).rejects.toThrow('wallet not found');
    await expect(service.initialize(userId, walletId, 1.001, randomUUID())).rejects.toThrow('two decimals');
    const key = randomUUID(); const topup = await service.initialize(userId, walletId, 100, key);
    await expect(service.initialize(userId, walletId, 200, key)).rejects.toThrow('different top-up');
    await expect(service.status('other', topup.reference)).rejects.toThrow('not found');
    amount = 99; await expect(service.settle(topup.reference)).rejects.toThrow('mismatch');
    amount = 100; currency = 'USD'; await expect(service.settle(topup.reference)).rejects.toThrow('mismatch');
    currency = 'GHS'; verifiedStatus = 'pending'; await service.settle(topup.reference);
    expect((await WalletModel.findById(walletId))!.balance).toBe(0);
  });
  it('rolls all money writes back if the target wallet disappears', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    await WalletModel.deleteOne({ _id: walletId });
    await expect(service.settle(topup.reference)).rejects.toThrow('no longer available');
    expect((await WalletTopUpModel.findOne({ reference: topup.reference }))!.status).toBe('pending');
    expect(await JournalEntryModel.countDocuments({ externalRef: topup.reference })).toBe(0);
  });

  // I039: an opened-but-unpaid Paystack checkout reports 'abandoned', even
  // seconds after the redirect while the payer is still on the page.
  it('keeps a recently abandoned checkout pending and credits it once when it is paid', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    verifiedStatus = 'abandoned';
    expect((await service.status(userId, topup.reference)).status).toBe('pending');
    verifiedStatus = 'success';
    expect((await service.status(userId, topup.reference)).status).toBe('completed');
    await service.settle(topup.reference);
    expect((await WalletModel.findById(walletId))!.balance).toBe(100);
    expect(await WalletTransactionModel.countDocuments({ reference: topup.reference })).toBe(1);
  });
  it('fails an abandoned checkout only once it is past the TTL', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    await WalletTopUpModel.collection.updateOne({ reference: topup.reference }, { $set: { createdAt: new Date(Date.now() - 25 * 3600_000) } });
    verifiedStatus = 'abandoned';
    expect((await service.status(userId, topup.reference)).status).toBe('failed');
  });
  it('the sweep credits a failed top-up that was paid after all, exactly once', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    verifiedStatus = 'failed';
    await service.settle(topup.reference);
    expect((await WalletTopUpModel.findOne({ reference: topup.reference }))!.status).toBe('failed');
    await WalletTopUpModel.collection.updateOne({ reference: topup.reference }, { $set: { updatedAt: new Date(Date.now() - 2 * 3600_000) } });
    verifiedStatus = 'success';
    const summary = await service.reconcile();
    expect(summary.completed).toBeGreaterThanOrEqual(1);
    expect((await WalletTopUpModel.findOne({ reference: topup.reference }))!.status).toBe('completed');
    await WalletTopUpModel.collection.updateMany({}, { $set: { updatedAt: new Date(Date.now() - 2 * 3600_000) } });
    await service.reconcile();
    expect((await WalletModel.findById(walletId))!.balance).toBe(100);
    expect(await JournalEntryModel.countDocuments({ externalRef: topup.reference })).toBe(1);
  });

  it('still credits a top-up confirmed after the account closed, but flags it for staff instead of landing silently', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    // The account closes while the payment is in flight (check-then-erase race or a very late success).
    await UserModel.updateOne({ _id: userId }, { $set: { deletedAt: new Date() } });
    const nextReviewAt = new Date(Date.now() + 7 * 86400000);
    await AccountDeletionRequestModel.create({ userId, contactEmail: 'closed@example.test', status: 'pending', nextReviewAt, reviewNotes: 'Staff note kept', revision: 2 });
    await service.settle(topup.reference);
    await service.settle(topup.reference);
    expect((await WalletModel.findById(walletId))!.balance).toBe(100);
    expect(await JournalEntryModel.countDocuments({ externalRef: topup.reference })).toBe(1);
    const flagged = await AccountDeletionRequestModel.findOne({ userId }).lean();
    expect(flagged).toMatchObject({ status: 'review_required', revision: 3 });
    expect(flagged!.nextReviewAt.getTime()).toBeLessThan(nextReviewAt.getTime());
    expect(flagged!.reviewNotes).toMatch(/^Staff note kept\n\[system [^\]]+\] Wallet top-up wtop-[\w-]+ credited GHS 100\.00 after the account was closed\.$/);
  });

  it('does not flag top-ups for open accounts', async () => {
    const topup = await service.initialize(userId, walletId, 100, randomUUID());
    await AccountDeletionRequestModel.create({ userId, contactEmail: 'open@example.test', nextReviewAt: new Date(Date.now() + 86400000) });
    await service.settle(topup.reference);
    expect(await AccountDeletionRequestModel.findOne({ userId }).lean()).toMatchObject({ status: 'pending', revision: 0, reviewNotes: '' });
  });
});
