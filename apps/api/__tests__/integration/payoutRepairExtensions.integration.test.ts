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
import { MongoPayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js';
import { MongoCampaignBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js';
import { MongoLedgerRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js';
import { MongoAffiliatePayoutRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliatePayoutRepository.js';
import { MongoAffiliateBalanceRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoAffiliateBalanceRepository.js';
import { HandlePayoutWebhookUseCase } from '../../src/application/use-cases/HandlePayoutWebhookUseCase.js';
import { HandleAffiliatePayoutWebhookUseCase } from '../../src/application/use-cases/HandleAffiliatePayoutWebhookUseCase.js';

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
});
