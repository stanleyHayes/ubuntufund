import { randomUUID } from 'node:crypto';

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { PayoutModel } from '../../src/infrastructure/database/models/PayoutModel.js';
import { CampaignBalanceModel } from '../../src/infrastructure/database/models/CampaignBalanceModel.js';
import { JournalEntryModel } from '../../src/infrastructure/database/models/JournalEntryModel.js';
import { AffiliatePayoutModel } from '../../src/infrastructure/database/models/AffiliatePayoutModel.js';
import { AffiliateBalanceModel } from '../../src/infrastructure/database/models/AffiliateBalanceModel.js';
import { BeneficiaryPayoutModel } from '../../src/infrastructure/database/models/BeneficiaryPayoutModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../src/infrastructure/database/models/CampaignBeneficiaryBalanceModel.js';
import { MongoPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoLedgerRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { MongoAffiliatePayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js';
import { MongoAffiliateBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js';
import { MongoBeneficiaryPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoBeneficiaryPayoutRepository.js';
import { MongoCampaignBeneficiaryBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBeneficiaryBalanceRepository.js';
import { HandlePayoutWebhookUseCase } from '../../src/application/use-cases/HandlePayoutWebhookUseCase.js';
import { HandleAffiliatePayoutWebhookUseCase } from '../../src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.js';
import { HandleBeneficiaryPayoutWebhookUseCase } from '../../src/application/use-cases/HandleBeneficiaryPayoutWebhookUseCase.js';

const past = () => new Date(Date.now() - 3600_000);

describe('Payout settlement repair — extended crash windows (G5)', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });
  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('findTerminalUnsettled ignores legacy payouts missing the settlementApplied field', async () => {
    const payoutRepo = new MongoPayoutRepository();
    const campaignId = `c-${randomUUID()}`;

    // A G5-era crashed payout: the field is present and false.
    const g5 = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 500, currency: 'GHS',
      status: 'PAID', provider: 'paystack', requestedBy: 'u', settlementApplied: false,
    });
    await PayoutModel.updateOne({ _id: g5._id }, { $set: { updatedAt: past() } }, { timestamps: false });

    // A legacy payout predating the field (absent) — already settled by the old
    // code; it must NEVER be treated as unsettled and re-applied.
    const legacy = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 500, currency: 'GHS',
      status: 'PAID', provider: 'paystack', requestedBy: 'u',
    });
    await PayoutModel.updateOne(
      { _id: legacy._id },
      { $unset: { settlementApplied: 1 }, $set: { updatedAt: past() } },
      { timestamps: false }
    );

    const found = await payoutRepo.findTerminalUnsettled(new Date());
    const ids = found.map((p) => p.id);
    expect(ids).toContain(g5._id!.toString());
    expect(ids).not.toContain(legacy._id!.toString());
  });

  it('repairSettlement returns the reservation for a FAILED payout a crash stranded', async () => {
    const useCase = new HandlePayoutWebhookUseCase(
      new MongoPayoutRepository(),
      new MongoCampaignBalanceRepository(),
      new MongoLedgerRepository()
    );
    const campaignId = `c-${randomUUID()}`;
    // Reserved out at request time; the failed transfer's return never ran.
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0 });
    const payout = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 300, currency: 'GHS',
      status: 'FAILED', provider: 'paystack', requestedBy: 'u', settlementApplied: false,
    });

    await useCase.repairSettlement(payout._id!.toString());
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(300);
    const after = await PayoutModel.findById(payout._id);
    expect(after?.settlementApplied).toBe(true);

    // Idempotent: a second repair does not double-return.
    await useCase.repairSettlement(payout._id!.toString());
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(300);
  });

  it('a FAILED payout already returned by the approval rollback is not double-credited by repair', async () => {
    // Regression: rollback returns the reservation WITH the `:returned` settleRef
    // and flags settlementApplied — so the repair (a) does not select it and
    // (b) even if it did, the settleRef guard makes returnToAvailable a no-op.
    const payoutRepo = new MongoPayoutRepository();
    const balanceRepo = new MongoCampaignBalanceRepository();
    const useCase = new HandlePayoutWebhookUseCase(payoutRepo, balanceRepo, new MongoLedgerRepository());
    const campaignId = `c-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0 });
    const payout = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 400, currency: 'GHS',
      status: 'FAILED', provider: 'paystack', requestedBy: 'u', settlementApplied: false,
    });
    // The rollback already returned the reservation once, recording the settleRef.
    await balanceRepo.returnToAvailable(campaignId, 400, `pout:${payout._id!.toString()}:returned`);
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(400);

    // The reconciliation repair must NOT return it a second time.
    await useCase.repairSettlement(payout._id!.toString());
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(400); // not 800
  });

  it('repairSettlement returns the reservation for a PROCESSING→REVERSED payout a crash stranded (G7)', async () => {
    const useCase = new HandlePayoutWebhookUseCase(
      new MongoPayoutRepository(),
      new MongoCampaignBalanceRepository(),
      new MongoLedgerRepository()
    );
    const campaignId = `c-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0 });
    const payout = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 250, currency: 'GHS', netAmount: 250, fee: 0,
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u',
      settlementApplied: false, reversedFrom: 'PROCESSING',
    });

    await useCase.repairSettlement(payout._id!.toString());
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(250);
    expect((await PayoutModel.findById(payout._id))?.settlementApplied).toBe(true);

    await useCase.repairSettlement(payout._id!.toString());
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.availableBalance).toBe(250); // idempotent
  });

  it('repairSettlement re-applies the reverse effect for a PAID→REVERSED payout whose reverse crashed (G7)', async () => {
    const useCase = new HandlePayoutWebhookUseCase(
      new MongoPayoutRepository(),
      new MongoCampaignBalanceRepository(),
      new MongoLedgerRepository()
    );
    const campaignId = `c-${randomUUID()}`;
    // The genuine reverse-crash: the forward DID land (paidOut 600), the transfer
    // was then reversed, but the reverse effect crashed before it ran.
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0, paidOutBalance: 600 });
    const payout = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 600, currency: 'GHS', netAmount: 600, fee: 0,
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u',
      settlementApplied: false, reversedFrom: 'PAID',
    });

    await useCase.repairSettlement(payout._id!.toString());
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(0); // reversed out of paidOut
    expect(bal?.availableBalance).toBe(600); // returned to available
    expect((await PayoutModel.findById(payout._id))?.settlementApplied).toBe(true);
    const rev = await JournalEntryModel.find({ externalRef: `pout:${payout._id!.toString()}:reversed` });
    expect(rev).toHaveLength(1); // one reversal journal, no forward re-drive

    await useCase.repairSettlement(payout._id!.toString());
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(0); // idempotent
    expect(bal?.availableBalance).toBe(600);
  });

  it('findTerminalUnsettled excludes a legacy REVERSED payout with no reversedFrom (G7 migration safety)', async () => {
    const payoutRepo = new MongoPayoutRepository();
    const campaignId = `c-${randomUUID()}`;
    const past = new Date(Date.now() - 3600_000);
    // A pre-G7 REVERSED payout: settlementApplied present-and-false, reversedFrom absent.
    const legacy = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 100, currency: 'GHS',
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u', settlementApplied: false,
    });
    await PayoutModel.updateOne({ _id: legacy._id }, { $set: { updatedAt: past } }, { timestamps: false });
    // A G7-era REVERSED payout (reversedFrom present) IS a candidate.
    const g7 = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 100, currency: 'GHS',
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u', settlementApplied: false, reversedFrom: 'PAID',
    });
    await PayoutModel.updateOne({ _id: g7._id }, { $set: { updatedAt: past } }, { timestamps: false });

    const ids = (await payoutRepo.findTerminalUnsettled(new Date())).map((p) => p.id);
    expect(ids).not.toContain(legacy._id!.toString()); // legacy REVERSED excluded → no endless re-scan
    expect(ids).toContain(g7._id!.toString());
  });

  it('affiliate repairSettlement credits paidOut once for a PAID payout a crash stranded', async () => {
    const useCase = new HandleAffiliatePayoutWebhookUseCase(
      new MongoAffiliatePayoutRepository(),
      new MongoAffiliateBalanceRepository()
    );
    const affiliateId = `a-${randomUUID()}`;
    await AffiliateBalanceModel.create({ affiliateId, currency: 'GHS', availableBalance: 0, paidOutBalance: 0 });
    const payout = await AffiliatePayoutModel.create({
      affiliateId, amount: 200, currency: 'GHS',
      status: 'PAID', provider: 'paystack', requestedBy: 'u', settlementApplied: false,
    });

    await useCase.repairSettlement(payout._id!.toString());
    let bal = await AffiliateBalanceModel.findOne({ affiliateId });
    expect(bal?.paidOutBalance).toBe(200);
    const after = await AffiliatePayoutModel.findById(payout._id);
    expect(after?.settlementApplied).toBe(true);

    // Idempotent per settleRef: a second repair does not double-credit.
    await useCase.repairSettlement(payout._id!.toString());
    bal = await AffiliateBalanceModel.findOne({ affiliateId });
    expect(bal?.paidOutBalance).toBe(200);
  });

  it('repairBatched applies an unsettled success leg and finalizes the batch', async () => {
    const useCase = new HandlePayoutWebhookUseCase(
      new MongoPayoutRepository(),
      new MongoCampaignBalanceRepository(),
      new MongoLedgerRepository()
    );
    const campaignId = `c-${randomUUID()}`;
    const legRef = `leg-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS' });
    // Batched payout PROCESSING; its one leg is 'success' but the effect never
    // landed (crash between setLegStatus and markPaidOut/reconcileBatch).
    const payout = await PayoutModel.create({
      campaignId, recipientId: 'r', amount: 500, currency: 'GHS',
      status: 'PROCESSING', provider: 'paystack', requestedBy: 'u',
      legs: [{ index: 0, amount: 500, reference: legRef, status: 'success' }],
    });

    await useCase.repairBatched(payout._id!.toString());
    let bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(500); // leg effect applied
    const after = await PayoutModel.findById(payout._id);
    expect(after?.status).toBe('PAID'); // batch finalized
    const journals = await JournalEntryModel.find({ externalRef: `leg:${legRef}:paid` });
    expect(journals).toHaveLength(1); // journal posted exactly once

    // Idempotent: the batch is now PAID (not PROCESSING) → a second repair is a no-op.
    await useCase.repairBatched(payout._id!.toString());
    bal = await CampaignBalanceModel.findOne({ campaignId });
    expect(bal?.paidOutBalance).toBe(500);
  });

  // ── Beneficiary rail REVERSED repair (G7) ────────────────────────────────
  function beneficiaryUseCase() {
    return new HandleBeneficiaryPayoutWebhookUseCase(
      new MongoBeneficiaryPayoutRepository(),
      new MongoCampaignBeneficiaryBalanceRepository(),
      new MongoCampaignBalanceRepository(),
      new MongoLedgerRepository()
    );
  }

  it('beneficiary PAID→REVERSED repair re-applies the reverse on BOTH buckets whose reverse crashed (G7)', async () => {
    const useCase = beneficiaryUseCase();
    const campaignId = `c-${randomUUID()}`;
    const beneficiaryId = `b-${randomUUID()}`;
    // Forward landed on both buckets (paidOut 400); reverse effect then crashed.
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0, paidOutBalance: 400 });
    await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', availableBalance: 0, paidOutBalance: 400 });
    const payout = await BeneficiaryPayoutModel.create({
      campaignId, beneficiaryId, recipientId: 'r', amount: 400, currency: 'GHS',
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u',
      settlementApplied: false, reversedFrom: 'PAID',
    });

    await useCase.repairSettlement(payout._id!.toString());
    const camp = await CampaignBalanceModel.findOne({ campaignId });
    const ben = await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId });
    expect(camp?.paidOutBalance).toBe(0); // reversed
    expect(camp?.availableBalance).toBe(400);
    expect(ben?.paidOutBalance).toBe(0);
    expect(ben?.availableBalance).toBe(400);
    expect((await BeneficiaryPayoutModel.findById(payout._id))?.settlementApplied).toBe(true);

    await useCase.repairSettlement(payout._id!.toString()); // idempotent
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(400);
    expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }))?.availableBalance).toBe(400);
  });

  it('beneficiary PROCESSING→REVERSED repair returns the reservation to BOTH buckets (G7)', async () => {
    const useCase = beneficiaryUseCase();
    const campaignId = `c-${randomUUID()}`;
    const beneficiaryId = `b-${randomUUID()}`;
    await CampaignBalanceModel.create({ campaignId, currency: 'GHS', availableBalance: 0 });
    await CampaignBeneficiaryBalanceModel.create({ campaignId, beneficiaryId, currency: 'GHS', availableBalance: 0 });
    const payout = await BeneficiaryPayoutModel.create({
      campaignId, beneficiaryId, recipientId: 'r', amount: 275, currency: 'GHS',
      status: 'REVERSED', provider: 'paystack', requestedBy: 'u',
      settlementApplied: false, reversedFrom: 'PROCESSING',
    });

    await useCase.repairSettlement(payout._id!.toString());
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(275);
    expect((await CampaignBeneficiaryBalanceModel.findOne({ campaignId, beneficiaryId }))?.availableBalance).toBe(275);
    expect((await BeneficiaryPayoutModel.findById(payout._id))?.settlementApplied).toBe(true);

    await useCase.repairSettlement(payout._id!.toString()); // idempotent
    expect((await CampaignBalanceModel.findOne({ campaignId }))?.availableBalance).toBe(275);
  });

  // ── Affiliate rail REVERSED repair (G7) ──────────────────────────────────
  it('affiliate PAID→REVERSED repair re-applies the reverse whose effect crashed (G7)', async () => {
    const useCase = new HandleAffiliatePayoutWebhookUseCase(
      new MongoAffiliatePayoutRepository(),
      new MongoAffiliateBalanceRepository()
    );
    const affiliateId = `a-${randomUUID()}`;
    // Forward landed (paidOut 150); reverse effect then crashed.
    await AffiliateBalanceModel.create({ affiliateId, currency: 'GHS', availableBalance: 0, paidOutBalance: 150 });
    const payout = await AffiliatePayoutModel.create({
      affiliateId, amount: 150, currency: 'GHS', status: 'REVERSED',
      provider: 'paystack', requestedBy: 'u', settlementApplied: false, reversedFrom: 'PAID',
    });

    await useCase.repairSettlement(payout._id!.toString());
    let bal = await AffiliateBalanceModel.findOne({ affiliateId });
    expect(bal?.paidOutBalance).toBe(0);
    expect(bal?.availableBalance).toBe(150);
    expect((await AffiliatePayoutModel.findById(payout._id))?.settlementApplied).toBe(true);

    await useCase.repairSettlement(payout._id!.toString()); // idempotent
    bal = await AffiliateBalanceModel.findOne({ affiliateId });
    expect(bal?.paidOutBalance).toBe(0);
    expect(bal?.availableBalance).toBe(150);
  });

  it('affiliate PROCESSING→REVERSED repair returns the reservation (G7)', async () => {
    const useCase = new HandleAffiliatePayoutWebhookUseCase(
      new MongoAffiliatePayoutRepository(),
      new MongoAffiliateBalanceRepository()
    );
    const affiliateId = `a-${randomUUID()}`;
    await AffiliateBalanceModel.create({ affiliateId, currency: 'GHS', availableBalance: 0 });
    const payout = await AffiliatePayoutModel.create({
      affiliateId, amount: 90, currency: 'GHS', status: 'REVERSED',
      provider: 'paystack', requestedBy: 'u', settlementApplied: false, reversedFrom: 'PROCESSING',
    });

    await useCase.repairSettlement(payout._id!.toString());
    expect((await AffiliateBalanceModel.findOne({ affiliateId }))?.availableBalance).toBe(90);
    expect((await AffiliatePayoutModel.findById(payout._id))?.settlementApplied).toBe(true);

    await useCase.repairSettlement(payout._id!.toString()); // idempotent
    expect((await AffiliateBalanceModel.findOne({ affiliateId }))?.availableBalance).toBe(90);
  });
});
