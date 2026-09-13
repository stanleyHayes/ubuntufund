import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import { connectTestDatabase, dropTestDatabase, disconnectTestDatabase } from '../helpers/testDatabase.js';
import { HandleBeneficiaryPayoutWebhookUseCase } from '../../src/application/use-cases/HandleBeneficiaryPayoutWebhookUseCase.js';
import { MongoBeneficiaryPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js';
import { MongoCampaignBeneficiaryBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryBalanceRepository.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoLedgerRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { MongoUnitOfWork } from '../../src/infrastructure/adapters/outbound/persistence/MongoUnitOfWork.js';
import { BeneficiaryPayoutModel } from '../../src/infrastructure/database/models/BeneficiaryPayoutModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
const payoutRepo = new MongoBeneficiaryPayoutRepository(), beneficiaryRepo = new MongoCampaignBeneficiaryBalanceRepository(), campaignRepo = new MongoCampaignBalanceRepository(), ledgerRepo = new MongoLedgerRepository();
const service = new HandleBeneficiaryPayoutWebhookUseCase(payoutRepo, beneficiaryRepo, campaignRepo, ledgerRepo, new MongoUnitOfWork());
beforeAll(async () => { await connectTestDatabase(); await Promise.all([BeneficiaryPayoutModel.init(), CampaignBalanceModel.init(), CampaignBeneficiaryBalanceModel.init(), JournalEntryModel.init()]); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });
afterEach(() => vi.restoreAllMocks());
async function seed(status: 'PROCESSING' | 'PAID' = 'PROCESSING', applied = status === 'PAID') {
  const campaignId = randomUUID(), beneficiaryId = randomUUID(), reference = `bpay-${randomUUID()}`;
  const payout = await BeneficiaryPayoutModel.create({ campaignId, beneficiaryId, recipientId: 'recipient', amount: 100, currency: 'GHS', status, provider: 'paystack', providerRef: reference, requestedBy: 'requester', settlementApplied: applied });
  const paid = status === 'PAID' && applied ? 100 : 0;
  await CampaignBalanceModel.create({ campaignId, currency: 'GHS', paidOutBalance: paid });
  await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', paidOutBalance: paid });
  const inspect = async () => ({ payout: await BeneficiaryPayoutModel.findById(payout.id).orFail(), campaign: await CampaignBalanceModel.findOne({ campaignId }).orFail(), beneficiary: await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }).orFail(), entries: await JournalEntryModel.find({ externalRef: { $regex: `^bpay:${payout.id}:` } }) });
  return { payout, campaignId, beneficiaryId, reference, inspect };
}
it.each(['campaign', 'journal', 'flag'])('rolls success settlement back after a failure at %s', async stage => {
  const f = await seed();
  const hook = stage === 'campaign' ? vi.spyOn(campaignRepo, 'markPaidOut').mockRejectedValueOnce(new Error('campaign unavailable')) : stage === 'journal' ? vi.spyOn(ledgerRepo, 'postEntry').mockImplementationOnce(async (...args) => { await MongoLedgerRepository.prototype.postEntry.apply(ledgerRepo, args); throw new Error('after journal write'); }) : vi.spyOn(payoutRepo, 'markSettlementApplied').mockImplementationOnce(async (...args) => { await MongoBeneficiaryPayoutRepository.prototype.markSettlementApplied.apply(payoutRepo, args); throw new Error('after flag write'); });
  await expect(service.handleSuccess(f.reference)).rejects.toThrow();
  hook.mockRestore();
  let state = await f.inspect();
  expect(state.payout.status).toBe('PROCESSING'); expect(state.payout.settlementApplied).toBe(false);
  expect(state.campaign.paidOutBalance).toBe(0); expect(state.beneficiary.paidOutBalance).toBe(0); expect(state.entries).toHaveLength(0);
  await service.handleSuccess(f.reference); await service.handleSuccess(f.reference);
  state = await f.inspect();
  expect(state.payout.status).toBe('PAID'); expect(state.payout.settlementApplied).toBe(true);
  expect(state.campaign.paidOutBalance).toBe(100); expect(state.beneficiary.paidOutBalance).toBe(100); expect(state.entries).toHaveLength(1);
});
it.each(['failed', 'reversed_processing', 'reversed_paid'])('rolls back and retries both returned balances: %s', async scenario => {
  const f = await seed(scenario === 'reversed_paid' ? 'PAID' : 'PROCESSING');
  const hook = scenario === 'reversed_paid' ? vi.spyOn(campaignRepo, 'reverseFromPaidOut').mockRejectedValueOnce(new Error('mirror unavailable')) : vi.spyOn(campaignRepo, 'returnToAvailable').mockRejectedValueOnce(new Error('mirror unavailable'));
  const settle = () => scenario === 'failed' ? service.handleFailed(f.reference) : service.handleReversed(f.reference);
  await expect(settle()).rejects.toThrow(); hook.mockRestore();
  let state = await f.inspect();
  expect(state.payout.status).toBe(scenario === 'reversed_paid' ? 'PAID' : 'PROCESSING');
  expect(state.campaign.availableBalance).toBe(0); expect(state.beneficiary.availableBalance).toBe(0);
  expect(state.entries).toHaveLength(0);
  await settle(); await settle(); state = await f.inspect();
  expect(state.payout.status).toBe(scenario === 'failed' ? 'FAILED' : 'REVERSED'); expect(state.payout.settlementApplied).toBe(true);
  expect(state.campaign.availableBalance).toBe(100); expect(state.beneficiary.availableBalance).toBe(100);
  expect(state.campaign.paidOutBalance).toBe(0); expect(state.beneficiary.paidOutBalance).toBe(0);
});
it('rolls repair effects back together and retries the outstanding terminal settlement', async () => {
  const f = await seed('PAID', false);
  const hook = vi.spyOn(campaignRepo, 'markPaidOut').mockRejectedValueOnce(new Error('repair mirror unavailable'));
  await expect(service.repairSettlement(f.payout.id)).rejects.toThrow(); hook.mockRestore();
  let state = await f.inspect(); expect(state.beneficiary.paidOutBalance).toBe(0); expect(state.payout.settlementApplied).toBe(false);
  await service.repairSettlement(f.payout.id); await service.repairSettlement(f.payout.id);
  state = await f.inspect(); expect(state.campaign.paidOutBalance).toBe(100); expect(state.beneficiary.paidOutBalance).toBe(100); expect(state.entries).toHaveLength(1); expect(state.payout.settlementApplied).toBe(true);
});
it('serializes competing success and failure callbacks with one monetary result', async () => {
  const f = await seed();
  await Promise.all([service.handleSuccess(f.reference), service.handleFailed(f.reference)]);
  const state = await f.inspect();
  expect(['PAID', 'FAILED']).toContain(state.payout.status); expect(state.payout.settlementApplied).toBe(true);
  expect(state.campaign.paidOutBalance + state.campaign.availableBalance).toBe(100);
  expect(state.beneficiary.paidOutBalance).toBe(state.campaign.paidOutBalance);
  expect(state.beneficiary.availableBalance).toBe(state.campaign.availableBalance);
  expect(state.entries).toHaveLength(state.payout.status === 'PAID' ? 1 : 0);
});
it.each(['beneficiary_missing', 'campaign_missing', 'beneficiary_short', 'campaign_short'])('does not mark broken settlement balances applied: %s', async scenario => {
  const short = scenario.endsWith('_short');
  const f = await seed(short ? 'PAID' : 'PROCESSING');
  if (scenario === 'beneficiary_missing') await CampaignBeneficiaryBalanceModel.deleteOne({ campaignId: f.campaignId });
  if (scenario === 'campaign_missing') await CampaignBalanceModel.deleteOne({ campaignId: f.campaignId });
  if (scenario === 'beneficiary_short') await CampaignBeneficiaryBalanceModel.updateOne({ campaignId: f.campaignId }, { paidOutBalance: 20 });
  if (scenario === 'campaign_short') await CampaignBalanceModel.updateOne({ campaignId: f.campaignId }, { paidOutBalance: 20 });
  await expect(short ? service.handleReversed(f.reference) : service.handleSuccess(f.reference)).rejects.toThrow(/reconciliation/);
  const payout = await BeneficiaryPayoutModel.findById(f.payout.id).orFail();
  expect(payout.status).toBe(short ? 'PAID' : 'PROCESSING');
  for (const balance of [await CampaignBalanceModel.findOne({ campaignId: f.campaignId }), await CampaignBeneficiaryBalanceModel.findOne({ campaignId: f.campaignId })]) {
    if (balance) { expect(balance.availableBalance).toBe(0); expect(balance.paidOutBalance).toBeGreaterThanOrEqual(0); }
  }
  expect(await JournalEntryModel.countDocuments({ externalRef: { $regex: `^bpay:${f.payout.id}:` } })).toBe(0);
});
it('serializes a terminal repair with a concurrent reversal before moving either balance', async () => {
  const f = await seed('PAID', false);
  let locked!: () => void, release!: () => void;
  const ready = new Promise<void>(resolve => { locked = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const lockOriginal = payoutRepo.lockForSettlement.bind(payoutRepo);
  const reverseOriginal = payoutRepo.transitionPaidToReversed.bind(payoutRepo);
  vi.spyOn(payoutRepo, 'lockForSettlement').mockImplementationOnce(async id => { const result = await lockOriginal(id); locked(); await gate; return result; });
  vi.spyOn(payoutRepo, 'transitionPaidToReversed').mockImplementation(async id => { release(); return reverseOriginal(id); });
  const repair = service.repairSettlement(f.payout.id);
  await ready;
  await Promise.all([repair, service.handleReversed(f.reference)]);
  const state = await f.inspect();
  expect(state.payout.status).toBe('REVERSED'); expect(state.payout.settlementApplied).toBe(true);
  expect(state.campaign.paidOutBalance).toBe(0); expect(state.beneficiary.paidOutBalance).toBe(0);
  expect(state.campaign.availableBalance).toBe(100); expect(state.beneficiary.availableBalance).toBe(100); expect(state.entries).toHaveLength(2);
});
it('keeps a rejected transfer repairable when the immediate reservation return fails', async () => {
  const { BeneficiaryPayoutUseCase } = await import('../../src/application/use-cases/BeneficiaryPayoutUseCase.js');
  const { MongoCampaignRepository } = await import('../../src/infrastructure/adapters/outbound/persistence/MongoCampaignRepository.js');
  const { MongoCampaignSplitRepository } = await import('../../src/infrastructure/adapters/outbound/persistence/MongoCampaignSplitRepository.js');
  const { MongoBeneficiaryRecipientRepository } = await import('../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryRecipientRepository.js');
  const { BeneficiaryRecipientModel } = await import('../../src/infrastructure/database/models/BeneficiaryRecipientModel.js');
  const f = await seed();
  const recipient = await BeneficiaryRecipientModel.create({ campaignId: f.campaignId, beneficiaryId: f.beneficiaryId, type: 'mobile_money', currency: 'GHS', accountName: 'Beneficiary', accountNumber: '0551234567', bankCode: 'MTN', recipientCode: 'RCP_fixture', kycVerified: true, kycVerifiedBy: 'reviewer', kycVerifiedAt: new Date(), createdBy: 'owner' });
  await BeneficiaryPayoutModel.updateOne({ _id: f.payout.id }, { status: 'PENDING', recipientId: recipient.id });
  await CampaignBalanceModel.updateOne({ campaignId: f.campaignId }, { availableBalance: 100 });
  await CampaignBeneficiaryBalanceModel.updateOne({ campaignId: f.campaignId }, { availableBalance: 100 });
  const transfer = vi.fn(async () => ({ status: 'failed', transferCode: 'TRF_rejected' }));
  const gateway = { isConfigured: () => true, getBalance: async () => [{ currency: 'GHS', balance: 1000 }], initiateTransfer: transfer } as unknown as import('../../src/domain/ports/outbound/PaymentGatewayPort.js').PaymentGatewayPort;
  const approvals = new BeneficiaryPayoutUseCase(true, new MongoCampaignRepository(), new MongoCampaignSplitRepository(), beneficiaryRepo, campaignRepo, new MongoBeneficiaryRecipientRepository(), payoutRepo, gateway, new MongoUnitOfWork(), 0, { assertCurrent: async () => {} });
  const hook = vi.spyOn(campaignRepo, 'returnToAvailable').mockRejectedValueOnce(new Error('return mirror unavailable'));
  await expect(approvals.approvePayout(f.payout.id, { userId: 'staff', role: 'admin' })).rejects.toThrow('return mirror unavailable'); hook.mockRestore();
  let state = await f.inspect();
  expect(state.payout.status).toBe('PROCESSING'); expect(state.payout.settlementApplied).toBe(false);
  expect(state.campaign.availableBalance).toBe(0); expect(state.beneficiary.availableBalance).toBe(0);
  await service.handleFailed(state.payout.providerRef!);
  state = await f.inspect(); expect(state.payout.status).toBe('FAILED'); expect(state.payout.settlementApplied).toBe(true);
  expect(state.campaign.availableBalance).toBe(100); expect(state.beneficiary.availableBalance).toBe(100); expect(transfer).toHaveBeenCalledTimes(1);
});
