import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { beforeAll, afterAll, afterEach, expect, it, vi } from 'vitest';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { createTestApp } from '../helpers/testApp.js';
import { SettleDonationUseCase } from '../../src/application/use-cases/SettleDonationUseCase.js';
import { PostDonationJournalUseCase } from '../../src/application/use-cases/PostDonationJournalUseCase.js';
import { CampaignLedgerProjector } from '../../src/application/services/CampaignLedgerProjector.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { MongoDonationIntentRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationIntentRepository.js';
import { MongoDonationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { MongoCampaignRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoLedgerRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { MongoOutboxRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoOutboxRepository.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { OutboxModel } from '../../src/infrastructure/database/models/OutboxModel.js';
beforeAll(async () => { await connectTestDatabase(); await createTestApp(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
afterEach(() => vi.restoreAllMocks());
async function fixture() {
  const campaign = await CampaignModel.create({ title: 'Atomic settlement', description: 'Contribution integrity', creatorId: new Types.ObjectId().toString(), currency: 'GHS', goalAmount: 1000, raisedAmount: 0, category: 'education', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const row = await DonationIntentModel.create({ campaignId: campaign.id, amount: 100, currency: 'GHS', provider: 'paystack', status: 'PENDING', idempotencyKey: randomUUID() });
  const repo = new MongoDonationIntentRepository(), ledger = new MongoLedgerRepository();
  const journal = new PostDonationJournalUseCase(ledger);
  const projector = new CampaignLedgerProjector(new MongoCampaignRepository(), new MongoCampaignBalanceRepository(), ledger);
  const outbox = new MongoOutboxRepository(), dispatcher = { dispatch: vi.fn(async () => {}) };
  const useCase = new SettleDonationUseCase(repo, new MongoDonationRepository(), journal, projector, outbox, dispatcher as never, new MongoUnitOfWork());
  const intent = (await repo.findById(row.id))!;
  const breakdown = { amount: 100, gross: 100, tip: 0, currency: 'GHS', processorFee: 2, platformFee: 3, beneficiaryNet: 95, providerRef: `ref-${row.id}` };
  return { campaign, intent, breakdown, journal, projector, outbox, dispatcher, useCase };
}
async function assertCommitted(f: Awaited<ReturnType<typeof fixture>>) {
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('SUCCEEDED');
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(100);
  expect(await CampaignBalanceModel.findOne({ campaignId: f.campaign.id }).lean()).toMatchObject({ pendingBalance: 95, totalRaised: 100, processorFees: 2, platformFees: 3 });
  expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(1);
  expect(await JournalEntryModel.countDocuments({ donationIntentId: f.intent.id })).toBe(1);
  expect(await OutboxModel.countDocuments({ 'payload.donationIntentId': f.intent.id })).toBe(1);
}
it.each(['journal', 'projection', 'outbox'] as const)('rolls back a failure after the %s write and retries without duplicate credits', async point => {
  const f = await fixture();
  if (point === 'journal') { const original = f.journal.execute.bind(f.journal); vi.spyOn(f.journal, 'execute').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('injected after write'); }); }
  if (point === 'projection') { const original = f.projector.projectDonation.bind(f.projector); vi.spyOn(f.projector, 'projectDonation').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('injected after write'); }); }
  if (point === 'outbox') { const original = f.outbox.enqueue.bind(f.outbox); vi.spyOn(f.outbox, 'enqueue').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('injected after write'); }); }
  await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('injected after write');
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(0);
  expect(await CampaignBalanceModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  expect(await JournalEntryModel.countDocuments({ donationIntentId: f.intent.id })).toBe(0);
  expect(await OutboxModel.countDocuments({ 'payload.donationIntentId': f.intent.id })).toBe(0);
  expect(f.dispatcher.dispatch).not.toHaveBeenCalled();
  await f.useCase.execute(f.intent, f.breakdown);
  await f.useCase.execute(f.intent, f.breakdown);
  await assertCommitted(f);
  expect(f.dispatcher.dispatch).toHaveBeenCalledTimes(1);
});
it('concurrent callbacks commit one complete settlement and one outbox event', async () => {
  const f = await fixture();
  await Promise.all([f.useCase.execute(f.intent, f.breakdown), f.useCase.execute(f.intent, f.breakdown)]);
  await assertCommitted(f);
  expect(f.dispatcher.dispatch).toHaveBeenCalledTimes(1);
});
it('dispatch observes committed funds and a delivery outage cannot turn success into a wallet refund', async () => {
  const f = await fixture();
  f.dispatcher.dispatch.mockImplementationOnce(async () => { await assertCommitted(f); throw new Error('delivery unavailable'); });
  expect((await f.useCase.execute(f.intent, f.breakdown)).status).toBe('SUCCEEDED');
  await assertCommitted(f);
  expect((await OutboxModel.findOne({ 'payload.donationIntentId': f.intent.id }))?.status).toBe('pending');
});
