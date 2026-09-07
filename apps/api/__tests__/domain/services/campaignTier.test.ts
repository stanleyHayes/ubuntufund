import { describe, it, expect } from 'vitest';
import {
  deriveCampaignTier,
  tierRequiresManualReview,
} from '../../../src/domain/services/campaignTier.js';

// v6 default GHS thresholds.
const THRESHOLDS = [10000, 50000, 250000, 1000000];

describe('deriveCampaignTier (spec §4)', () => {
  it('maps goals to tiers 1–5 by the ascending thresholds', () => {
    expect(deriveCampaignTier(5000, THRESHOLDS)).toBe(1); // ≤ 10k
    expect(deriveCampaignTier(10000, THRESHOLDS)).toBe(1); // boundary stays low
    expect(deriveCampaignTier(10001, THRESHOLDS)).toBe(2);
    expect(deriveCampaignTier(50000, THRESHOLDS)).toBe(2);
    expect(deriveCampaignTier(60000, THRESHOLDS)).toBe(3);
    expect(deriveCampaignTier(250000, THRESHOLDS)).toBe(3);
    expect(deriveCampaignTier(300000, THRESHOLDS)).toBe(4);
    expect(deriveCampaignTier(1000000, THRESHOLDS)).toBe(4);
    expect(deriveCampaignTier(5000000, THRESHOLDS)).toBe(5);
  });

  it('is always Tier 1 with no thresholds', () => {
    expect(deriveCampaignTier(9_999_999, [])).toBe(1);
  });
});

describe('tierRequiresManualReview', () => {
  it('auto-approves up to the configured max tier, reviews above it', () => {
    // Default autoApproveMaxTier = 2 → Tiers 1–2 auto, 3+ manual.
    expect(tierRequiresManualReview(1, 2)).toBe(false);
    expect(tierRequiresManualReview(2, 2)).toBe(false);
    expect(tierRequiresManualReview(3, 2)).toBe(true);
    expect(tierRequiresManualReview(5, 2)).toBe(true);
    // 0 → review everything (legacy-safe posture).
    expect(tierRequiresManualReview(1, 0)).toBe(true);
  });
});
