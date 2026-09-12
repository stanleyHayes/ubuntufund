import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoCommercialConfigRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoCommercialConfigRepository.js';
import {
  CommercialConfigService,
  AFFILIATE_REFERRAL_DISCOUNT_KEY,
  CAMPAIGN_AUTO_APPROVE_TIER_KEY,
  CAMPAIGN_TIER_THRESHOLD_KEYS,
  REVIEW_ALERT_EMAIL_KEY,
} from '../../src/application/services/CommercialConfigService.js';
import { CommercialConfigModel } from '../../src/infrastructure/database/models/CommercialConfigModel.js';
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js';
import type { PayoutsConfig } from '../../src/infrastructure/config/index.js';

/**
 * Built here rather than imported: pulling in the real config module requires
 * JWT_SECRET and the rest of the app's environment, which this has no use for.
 */
const PAYOUTS: PayoutsConfig = {
  priorityFeePercent: 0.5,
  priorityMinFee: 10,
  earlyFeePercent: 1,
  earlyMinFee: 20,
  urgentFeePercent: 2,
  urgentMinFee: 40,
  assistedFeePercent: 1,
  assistedFixedFee: 15,
  earlyMaxWithdrawalPercent: 60,
  maxTransferAmount: 50_000,
  dualApprovalAmount: 20_000,
};

/**
 * The referral discount is a live pricing lever. It has to be settable from the
 * admin dashboard, take effect without a deploy, and keep the audit trail the
 * versioned store exists to provide.
 */

let service: CommercialConfigService;

beforeAll(async () => {
  await connectTestDatabase();
  service = new CommercialConfigService(
    new MongoCommercialConfigRepository(),
    PAYOUTS,
    { commissionPercent: 10, holdDays: 14, referralDiscountPercent: 10 },
    { tierThresholds: [10_000, 50_000, 250_000, 1_000_000], autoApproveMaxTier: 3 }
  );
});

afterAll(async () => {
  await dropTestDatabase();
  await disconnectTestDatabase();
});

beforeEach(async () => {
  await CommercialConfigModel.deleteMany({});
});

describe('the admin-controlled referral discount', () => {
  it('falls back to the env default when nothing has been set', async () => {
    expect(await service.resolveReferralDiscountPercent()).toBe(10);
  });

  it('takes the admin value once set, with no restart', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 15, 'admin-1', new Date());
    expect(await service.resolveReferralDiscountPercent()).toBe(15);
  });

  it('can be switched off with zero, rather than only lowered', async () => {
    // Zero is the off switch for the whole behaviour, so it must survive the
    // falsy-value trap that would otherwise fall back to the default.
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 0, 'admin-1', new Date());
    expect(await service.resolveReferralDiscountPercent()).toBe(0);
  });

  it('is accepted as a known key, so the admin route will not reject it', async () => {
    expect(service.isKnownKey(AFFILIATE_REFERRAL_DISCOUNT_KEY)).toBe(true);
    expect(service.allKeys).toContain(AFFILIATE_REFERRAL_DISCOUNT_KEY);
    // And an unknown key is still refused.
    expect(service.isKnownKey('affiliate.somethingElse')).toBe(false);
  });

  it('does not disturb the payouts config it shares a store with', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 25, 'admin-1', new Date());
    const payouts = await service.resolvePayoutsConfig();
    expect(payouts.earlyFeePercent).toBe(PAYOUTS.earlyFeePercent);
  });

  it('keeps every change as history, which is the audit trail', async () => {
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 10, 'admin-1', new Date(), 'launch');
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 20, 'admin-2', new Date(), 'push');

    const history = await service.history(AFFILIATE_REFERRAL_DISCOUNT_KEY);
    expect(history.length).toBe(2);
    expect(history.map((h) => h.createdBy)).toContain('admin-2');
  });

  it('honours a rate scheduled to start later only once it is effective', async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    await service.setValue(AFFILIATE_REFERRAL_DISCOUNT_KEY, 50, 'admin-1', tomorrow);
    expect(
      await service.resolveReferralDiscountPercent(),
      'a future-dated rate must not apply today'
    ).toBe(10);
  });
});

describe('the admin-controlled campaign review rules', () => {
  it('defaults to auto-approving up to tier 3', async () => {
    const cfg = await service.resolveCampaignsConfig();
    expect(cfg.autoApproveMaxTier).toBe(3);
    expect(cfg.tierThresholds).toEqual([10_000, 50_000, 250_000, 1_000_000]);
  });

  it('takes an admin value without a restart', async () => {
    await service.setValue(CAMPAIGN_AUTO_APPROVE_TIER_KEY, 1, 'admin-1', new Date());
    expect((await service.resolveCampaignsConfig()).autoApproveMaxTier).toBe(1);
  });

  it('lets zero mean "review everything" rather than falling back', async () => {
    // The off switch again: a falsy-coalescing read would restore the default
    // and silently keep auto-approving after an admin asked it to stop.
    await service.setValue(CAMPAIGN_AUTO_APPROVE_TIER_KEY, 0, 'admin-1', new Date());
    expect((await service.resolveCampaignsConfig()).autoApproveMaxTier).toBe(0);
  });

  it('applies a changed boundary', async () => {
    await service.setValue(CAMPAIGN_TIER_THRESHOLD_KEYS[1], 120_000, 'admin-1', new Date());
    const cfg = await service.resolveCampaignsConfig();
    expect(cfg.tierThresholds).toEqual([10_000, 120_000, 250_000, 1_000_000]);
  });

  it('keeps the boundaries ascending however they were saved', async () => {
    // deriveCampaignTier counts how many boundaries a goal exceeds, so an
    // out-of-order set would mis-tier every new campaign — and mis-tiering is
    // what decides whether someone can raise money today or waits on a human.
    await service.setValue(CAMPAIGN_TIER_THRESHOLD_KEYS[0], 900_000, 'admin-1', new Date());
    const cfg = await service.resolveCampaignsConfig();
    expect(cfg.tierThresholds).toEqual([...cfg.tierThresholds].sort((a, b) => a - b));
  });

  it('ignores a zero threshold rather than collapsing a tier boundary', async () => {
    await service.setValue(CAMPAIGN_TIER_THRESHOLD_KEYS[2], 0, 'admin-1', new Date());
    expect((await service.resolveCampaignsConfig()).tierThresholds).toContain(250_000);
  });
});

describe('the admin-controlled review alert recipient', () => {
  it('uses the env fallback until an admin sets one', async () => {
    expect(await service.resolveReviewAlertEmail('info@ujimora.com')).toBe('info@ujimora.com');
  });

  it('takes the admin value', async () => {
    await service.setTextValue(REVIEW_ALERT_EMAIL_KEY, 'trust@ujimora.com', 'admin-1', new Date());
    expect(await service.resolveReviewAlertEmail('info@ujimora.com')).toBe('trust@ujimora.com');
  });

  it('treats an empty value as "off", not as unset', async () => {
    // Clearing the field is how an admin turns the alerts off. Coalescing an
    // empty string back to the fallback would silently keep emailing them.
    await service.setTextValue(REVIEW_ALERT_EMAIL_KEY, '', 'admin-1', new Date());
    expect(await service.resolveReviewAlertEmail('info@ujimora.com')).toBe('');
  });

  it('is a known key, so the admin route accepts it', async () => {
    expect(service.isKnownKey(REVIEW_ALERT_EMAIL_KEY)).toBe(true);
    expect(service.isTextKey(REVIEW_ALERT_EMAIL_KEY)).toBe(true);
    // And a numeric key is not mistaken for a text one.
    expect(service.isTextKey(CAMPAIGN_AUTO_APPROVE_TIER_KEY)).toBe(false);
  });

  it('does not leak a text row into the numeric config reads', async () => {
    // The two share a collection. A text row has no `value`, so surfacing it in
    // the numeric map would hand callers undefined where they expect a number.
    await service.setTextValue(REVIEW_ALERT_EMAIL_KEY, 'trust@ujimora.com', 'admin-1', new Date());
    const payouts = await service.resolvePayoutsConfig();
    expect(Object.values(payouts).every((v) => typeof v === 'number')).toBe(true);
    const campaigns = await service.resolveCampaignsConfig();
    expect(campaigns.tierThresholds.every((v) => typeof v === 'number')).toBe(true);
  });
});
