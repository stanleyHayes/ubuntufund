import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { backfillContributionMinorUnits } from '../../src/infrastructure/database/backfillContributionMoney.js';

describe('Contribution money backfill (spec §21)', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
    await disconnectTestDatabase();
  });

  it('backfills minor units + currency on a legacy GHS intent, then is idempotent', async () => {
    // A legacy record: float GHS amount/tip, no minor-unit fields.
    const legacy = await DonationIntentModel.create({
      campaignId: 'c1',
      amount: 100,
      tip: 20,
      currency: 'GHS',
      donorUserId: 'u1',
      isAnonymous: false,
      status: 'SUCCEEDED',
      provider: 'paystack',
      idempotencyKey: 'legacy-1',
    });

    const first = await backfillContributionMinorUnits();
    expect(first).toBe(1);

    const after = await DonationIntentModel.findById(legacy._id);
    expect(after?.originalAmountMinor).toBe(12000); // (100 + 20) * 100
    expect(after?.originalCurrency).toBe('GHS');
    expect(after?.settlementAmountMinor).toBe(12000);
    expect(after?.settlementCurrency).toBe('GHS');
    expect(after?.fxRate).toBe(1);
    expect(after?.fxSource).toBe('legacy-backfill');

    // Idempotent: a second run touches nothing.
    const second = await backfillContributionMinorUnits();
    expect(second).toBe(0);
  });

  it('never overwrites a record that already carries minor-unit settlement data', async () => {
    const diaspora = await DonationIntentModel.create({
      campaignId: 'c2',
      amount: 155, // display GHS estimate
      tip: 0,
      currency: 'GHS',
      donorUserId: null,
      isAnonymous: true,
      status: 'SUCCEEDED',
      provider: 'paystack',
      idempotencyKey: 'diaspora-1',
      originalAmountMinor: 1000, // $10.00
      originalCurrency: 'USD',
      settlementAmountMinor: 15500,
      settlementCurrency: 'GHS',
      fxRate: 15.5,
      fxSource: 'provider',
    });

    const updated = await backfillContributionMinorUnits();
    expect(updated).toBe(0);

    const after = await DonationIntentModel.findById(diaspora._id);
    expect(after?.originalCurrency).toBe('USD');
    expect(after?.originalAmountMinor).toBe(1000);
    expect(after?.fxSource).toBe('provider');
  });
});
