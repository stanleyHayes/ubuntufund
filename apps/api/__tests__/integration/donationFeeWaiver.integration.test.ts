import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/testApp.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import { CouponModel } from '../../src/infrastructure/database/models/CouponModel.js';
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js';
import { DonationIntentModel } from '../../src/infrastructure/database/models/DonationIntentModel.js';
import { CampaignCategory, CampaignPriority } from '@ubuntu-fund/types';

/**
 * A fee-waiver coupon on a donation.
 *
 * The invariant that matters is not the discount, it is the split: the donor
 * gives exactly what they chose, the platform takes less, and the campaign
 * receives the difference. JournalEntry asserts
 * `beneficiaryNet === amount - platformFee - processorFee` in its constructor,
 * so a waiver that lowered the fee without raising the net would throw at
 * settlement rather than quietly mis-credit.
 */

let app: Express;

beforeAll(async () => {
  await connectTestDatabase();
  app = await createTestApp();
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await CouponModel.deleteMany({});
  await DonationIntentModel.deleteMany({});
});

const uniqueEmail = (p: string) => `${p}-${Date.now()}-${Math.random().toString(16).slice(2)}@test.io`;

async function registerUser(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Donor', email, password: 'SecurePass123' });
  return {
    token: res.body.data.tokens.accessToken as string,
    userId: res.body.data.user.id as string,
  };
}

async function createCampaign(creatorId: string) {
  const doc = await CampaignModel.create({
    creatorId,
    title: 'Fee waiver campaign',
    description: 'A campaign',
    goalAmount: 5000,
    raisedAmount: 0,
    currency: 'GHS',
    category: CampaignCategory.EDUCATION,
    priority: CampaignPriority.NORMAL,
    status: 'active',
    slug: `waiver-${Date.now()}`,
    startDate: new Date(),
    endDate: new Date(Date.now() + 86_400_000),
    lockedPlatformFeePercent: 10,
  });
  return doc._id!.toString();
}

async function seedCoupon(overrides: Record<string, unknown> = {}) {
  return CouponModel.create({
    code: 'ZEROFEE',
    discountType: 'percent',
    amount: 100,
    currency: 'GHS',
    redemptions: 0,
    appliesToSurfaces: ['donation'],
    active: true,
    ...overrides,
  });
}

describe('a fee-waiver coupon on a donation', () => {
  it('locks a reduced fee rate onto the intent without touching the donation amount', async () => {
    const { token, userId } = await registerUser(uniqueEmail('waiver'));
    const campaignId = await createCampaign(userId);
    await seedCoupon(); // 100% off a 10% fee → 0% effective

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId, amount: 200, provider: 'wallet', couponCode: 'ZEROFEE' });

    // The wallet is empty, so the charge fails — irrelevant here. What matters
    // is the intent the coupon was priced onto, which is written either way.
    expect(res.body?.message ?? '').toMatch(/Insufficient wallet balance/i);

    const intent = await DonationIntentModel.findOne({ campaignId }).sort({ createdAt: -1 });
    expect(intent, 'the intent is created even if the wallet has no funds').not.toBeNull();
    // The donor still gives 200; only the platform's cut changed.
    expect(intent!.amount).toBe(200);
    expect(intent!.platformFeePercentOverride).toBe(0);
    expect(intent!.couponCode).toBe('ZEROFEE');
  });

  it('halves the fee for a 50% coupon rather than halving the donation', async () => {
    const { token, userId } = await registerUser(uniqueEmail('half'));
    const campaignId = await createCampaign(userId);
    await seedCoupon({ code: 'HALFFEE', amount: 50 });

    await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId, amount: 200, provider: 'wallet', couponCode: 'HALFFEE' });

    const intent = await DonationIntentModel.findOne({ campaignId }).sort({ createdAt: -1 });
    expect(intent!.amount).toBe(200);
    // A 10% locked rate, halved.
    expect(intent!.platformFeePercentOverride).toBeCloseTo(5, 6);
  });

  it('refuses a subscription-only coupon instead of quietly ignoring it', async () => {
    // Silently dropping the code would take the donor's money on terms they did
    // not agree to — they typed it expecting the campaign to receive more.
    const { token, userId } = await registerUser(uniqueEmail('wrongsurface'));
    const campaignId = await createCampaign(userId);
    await seedCoupon({ code: 'SUBONLY', appliesToSurfaces: [] });

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId, amount: 200, provider: 'wallet', couponCode: 'SUBONLY' });

    expect(res.status).toBe(422);
    expect(await DonationIntentModel.countDocuments({ campaignId })).toBe(0);
  });

  it('refuses an unknown code', async () => {
    const { token, userId } = await registerUser(uniqueEmail('unknown'));
    const campaignId = await createCampaign(userId);

    const res = await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId, amount: 200, provider: 'wallet', couponCode: 'NOPE' });

    expect(res.status).toBe(422);
  });

  it('leaves an ordinary donation completely untouched', async () => {
    // The regression that would matter most: no override, no coupon fields, and
    // the campaign's locked rate still applies.
    const { token, userId } = await registerUser(uniqueEmail('plain'));
    const campaignId = await createCampaign(userId);

    await request(app)
      .post('/api/v1/donation-intents')
      .set('Authorization', `Bearer ${token}`)
      .send({ campaignId, amount: 200, provider: 'wallet' });

    const intent = await DonationIntentModel.findOne({ campaignId }).sort({ createdAt: -1 });
    expect(intent!.platformFeePercentOverride).toBeUndefined();
    expect(intent!.couponId).toBeUndefined();
  });
});
