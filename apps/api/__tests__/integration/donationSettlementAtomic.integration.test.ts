import { WalletModel } from '../../src/infrastructure/database/models/WalletModel.js';
import { WalletTransactionModel } from '../../src/infrastructure/database/models/WalletTransactionModel.js';
import { MongoWalletRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletRepository.js';
import { MongoWalletTransactionRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoWalletTransactionRepository.js';
import { SplitAccrualService } from '../../src/application/services/SplitAccrualService.js';
import { MongoCampaignSplitRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.js';
import { MongoCampaignBeneficiaryBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryBalanceRepository.js';
import { MongoCampaignBeneficiaryAccrualRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryAccrualRepository.js';
import { CampaignSplitVersionModel } from '../../src/infrastructure/database/models/CampaignSplitVersionModel.js';
import { CampaignBeneficiaryAccrualModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryAccrualModel.js';
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
async function fixture(withSplit = false, withWallet = false) {
  const campaign = await CampaignModel.create({ title: 'Atomic settlement', description: 'Contribution integrity', creatorId: new Types.ObjectId().toString(), currency: 'GHS', goalAmount: 1000, raisedAmount: 0, category: 'education', status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 86400000) });
  const row = await DonationIntentModel.create({ campaignId: campaign.id, amount: 100, currency: 'GHS', provider: withWallet ? 'wallet' : 'paystack', donorUserId: withWallet ? new Types.ObjectId().toString() : undefined, status: 'PENDING', idempotencyKey: randomUUID() });
  const wallet = withWallet ? await WalletModel.create({ userId: row.donorUserId, type: 'local', currency: 'GHS', balance: 200 }) : undefined;
  const walletRepo = new MongoWalletRepository(), walletTx = new MongoWalletTransactionRepository();
  const repo = new MongoDonationIntentRepository(), ledger = new MongoLedgerRepository();
  const journal = new PostDonationJournalUseCase(ledger);
  const splitRepo = new MongoCampaignSplitRepository();
  if (withSplit) await CampaignSplitVersionModel.create({ campaignId: campaign.id, version: 1, status: 'active', locked: false, createdBy: campaign.creatorId, allocations: [{ beneficiaryId: 'A', name: 'Ama', shareBps: 6000, consent: 'accepted' }, { beneficiaryId: 'B', name: 'Kofi', shareBps: 4000, consent: 'accepted' }] });
  const split = withSplit ? new SplitAccrualService(true, splitRepo, new MongoCampaignBeneficiaryBalanceRepository(), new MongoCampaignBeneficiaryAccrualRepository()) : undefined;
  const projector = new CampaignLedgerProjector(new MongoCampaignRepository(), new MongoCampaignBalanceRepository(), ledger, split);
  const outbox = new MongoOutboxRepository(), dispatcher = { dispatch: vi.fn(async () => {}) };
  const useCase = new SettleDonationUseCase(repo, new MongoDonationRepository(), journal, projector, outbox, dispatcher as never, new MongoUnitOfWork(), undefined, undefined, walletRepo, walletTx);
  const intent = (await repo.findById(row.id))!;
  const breakdown = { amount: 100, gross: 100, tip: 0, currency: 'GHS', processorFee: 2, platformFee: 3, beneficiaryNet: 95, providerRef: `ref-${row.id}` };
  return { campaign, intent, breakdown, journal, projector, outbox, dispatcher, useCase, splitRepo, wallet, walletRepo, walletTx };
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

it('requires current consent and rolls back the split lock and donation until consent is restored', async () => {
  const f = await fixture(true);
  await f.splitRepo.setConsent(f.campaign.id, 1, 'A', 'declined');
  await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('Every beneficiary must consent');
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
  expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(0);
  expect((await f.splitRepo.findActive(f.campaign.id))?.locked).toBe(false);
  expect(await CampaignBeneficiaryAccrualModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  await f.splitRepo.setConsent(f.campaign.id, 1, 'A', 'accepted');
  await f.useCase.execute(f.intent, f.breakdown);
  await assertCommitted(f);
  expect(await CampaignBeneficiaryAccrualModel.findOne({ donationIntentId: f.intent.id }).lean()).toMatchObject({ splitVersion: 1, entries: [{ beneficiaryId: 'A', amount: 57 }, { beneficiaryId: 'B', amount: 38 }] });
});
it('uses the returned locked version for subsequent contributions without a second active-version read', async () => {
  const f = await fixture(true);
  vi.spyOn(f.splitRepo, 'findActive').mockRejectedValue(new Error('A separate active read is unsafe'));
  await f.useCase.execute(f.intent, f.breakdown);
  const first = await CampaignSplitVersionModel.findOne({ campaignId: f.campaign.id, version: 1 }).lean();
  const row = await DonationIntentModel.create({ campaignId: f.campaign.id, amount: 100, currency: 'GHS', provider: 'paystack', status: 'PENDING', idempotencyKey: randomUUID() });
  const intent = (await new MongoDonationIntentRepository().findById(row.id))!;
  await f.useCase.execute(intent, { ...f.breakdown, providerRef: `ref-${row.id}` });
  const second = await CampaignSplitVersionModel.findOne({ campaignId: f.campaign.id, version: 1 }).lean();
  expect(second?.lockedAt).toEqual(first?.lockedAt);
  expect(second?.accrualWriteVersion).toBe(2);
  expect(await CampaignBeneficiaryAccrualModel.countDocuments({ campaignId: f.campaign.id, splitVersion: 1 })).toBe(2);
});
it('rechecks consent changed after the settlement snapshot began', async () => {
  const f = await fixture(true);
  const original = f.splitRepo.lockActive.bind(f.splitRepo);
  vi.spyOn(f.splitRepo, 'lockActive').mockImplementationOnce(async campaignId => {
    // Native collection write intentionally runs outside Mongoose transaction ALS.
    await CampaignSplitVersionModel.collection.updateOne({ campaignId, version: 1 }, { $set: { 'allocations.0.consent': 'declined' } });
    return original(campaignId);
  });
  await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('Every beneficiary must consent');
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
  expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
  expect(await CampaignBeneficiaryAccrualModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});
it('retries against an amendment activated before the campaign projection is committed', async () => {
  const f = await fixture(true);
  await CampaignSplitVersionModel.create({ campaignId: f.campaign.id, version: 2, status: 'draft', locked: false, createdBy: f.campaign.creatorId, allocations: [{ beneficiaryId: 'C', name: 'Abena', shareBps: 5000, consent: 'accepted' }, { beneficiaryId: 'D', name: 'Yaw', shareBps: 5000, consent: 'accepted' }] });
  const original = f.journal.execute.bind(f.journal);
  vi.spyOn(f.journal, 'execute').mockImplementationOnce(async (...args) => {
    const result = await original(...args);
    await new MongoCampaignSplitRepository().activate(f.campaign.id, 2);
    return result;
  });
  await f.useCase.execute(f.intent, f.breakdown);
  await assertCommitted(f);
  expect(await CampaignBeneficiaryAccrualModel.findOne({ donationIntentId: f.intent.id }).lean()).toMatchObject({ splitVersion: 2, entries: [{ beneficiaryId: 'C', amount: 47.5 }, { beneficiaryId: 'D', amount: 47.5 }] });
  expect(await CampaignSplitVersionModel.findOne({ campaignId: f.campaign.id, version: 1 }).lean()).toMatchObject({ status: 'superseded', locked: false });
  expect(await CampaignSplitVersionModel.findOne({ campaignId: f.campaign.id, version: 2 }).lean()).toMatchObject({ status: 'active', locked: true });
});

for (const failingWrite of ['wallet', 'history', 'projection'] as const) {
  it(`rolls back the wallet debit and complete settlement after ${failingWrite} write failure, then retries once`, async () => {
    const f = await fixture(false, true);
    function failAfterWrite<Args extends unknown[], Result>(original: (...args: Args) => Promise<Result>) {
      return async (...args: Args): Promise<Result> => {
        await original(...args); throw new Error('Injected wallet settlement interruption');
      };
    }
    if (failingWrite === 'wallet') vi.spyOn(f.walletRepo, 'withdrawIfSufficient').mockImplementationOnce(failAfterWrite(f.walletRepo.withdrawIfSufficient.bind(f.walletRepo)));
    else if (failingWrite === 'history') vi.spyOn(f.walletTx, 'record').mockImplementationOnce(failAfterWrite(f.walletTx.record.bind(f.walletTx)));
    else vi.spyOn(f.projector, 'projectDonation').mockImplementationOnce(failAfterWrite(f.projector.projectDonation.bind(f.projector)));
    await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('Injected wallet settlement interruption');
    expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(200);
    expect(await WalletTransactionModel.countDocuments({ userId: f.intent.donorUserId })).toBe(0);
    expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
    expect((await CampaignModel.findById(f.campaign.id))?.raisedAmount).toBe(0);
    await f.useCase.execute(f.intent, f.breakdown);
    await f.useCase.execute(f.intent, f.breakdown);
    await assertCommitted(f);
    expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(100);
    expect(await WalletTransactionModel.countDocuments({ userId: f.intent.donorUserId })).toBe(1);
  });
}
it('serializes concurrent wallet settlement and keeps committed debit when delivery fails', async () => {
  const f = await fixture(false, true);
  f.dispatcher.dispatch.mockRejectedValue(new Error('Delivery unavailable'));
  await Promise.all([f.useCase.execute(f.intent, f.breakdown), f.useCase.execute(f.intent, f.breakdown)]);
  await assertCommitted(f);
  expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(100);
  expect(await WalletTransactionModel.countDocuments({ userId: f.intent.donorUserId })).toBe(1);
});
it('commits a known insufficient-wallet refusal without credit or history', async () => {
  const f = await fixture(false, true);
  await WalletModel.updateOne({ _id: f.wallet!.id }, { $set: { balance: 10 } });
  await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('Insufficient wallet balance');
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('FAILED');
  expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(10);
  expect(await WalletTransactionModel.countDocuments({ userId: f.intent.donorUserId })).toBe(0);
  expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});
it('rejects wallet settlement amounts that differ from the stored charge', async () => {
  const f = await fixture(false, true);
  await expect(f.useCase.execute(f.intent, { ...f.breakdown, gross: 99 })).rejects.toThrow('does not match');
  expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(200);
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
});

for (const invalidCampaign of ['deleted', 'currency'] as const) {
  it(`rolls back all settlement writes when campaign accounting rejects ${invalidCampaign}`, async () => {
    const f = await fixture();
    await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: invalidCampaign === 'deleted' ? { deletedAt: new Date() } : { currency: 'USD' } });
    await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('Campaign accounting could not be updated');
    expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
    expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
    expect(await JournalEntryModel.countDocuments({ donationIntentId: f.intent.id })).toBe(0);
    expect(await OutboxModel.countDocuments({ 'payload.donationIntentId': f.intent.id })).toBe(0);
  });
}
it('rechecks a campaign blocked independently after wallet settlement started', async () => {
  const f = await fixture(false, true);
  const original = f.journal.execute.bind(f.journal);
  vi.spyOn(f.journal, 'execute').mockImplementationOnce(async (...args) => {
    const result = await original(...args);
    // A separate moderation write, outside the settlement transaction snapshot.
    await CampaignModel.collection.updateOne({ _id: f.campaign._id }, { $set: { status: 'blocked' } });
    return result;
  });
  await expect(f.useCase.execute(f.intent, f.breakdown)).rejects.toThrow('not accepting this wallet donation');
  expect((await WalletModel.findById(f.wallet!.id))?.balance).toBe(200);
  expect(await WalletTransactionModel.countDocuments({ userId: f.intent.donorUserId })).toBe(0);
  expect((await DonationIntentModel.findById(f.intent.id))?.status).toBe('PENDING');
  expect(await DonationModel.countDocuments({ campaignId: f.campaign.id })).toBe(0);
});
it('accounts for a verified external payment received after the campaign ended', async () => {
  const f = await fixture();
  await CampaignModel.updateOne({ _id: f.campaign.id }, { $set: { status: 'expired', endDate: new Date(Date.now() - 1000) } });
  await f.useCase.execute(f.intent, f.breakdown);
  await assertCommitted(f);
});
