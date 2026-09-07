/**
 * Campaign risk/value tiering (spec §4). A campaign's tier is derived once, from
 * its goal against admin-configured ascending thresholds, and stored so the tier
 * is stable even if the thresholds later change.
 */

/**
 * The tier (1–5) for a goal against ascending `thresholds` (e.g. GHS
 * 10k/50k/250k/1M). Tier = 1 + (number of thresholds the goal strictly exceeds),
 * so a goal AT a boundary stays in the lower tier (Tier 1 = "up to GHS 10k").
 */
export function deriveCampaignTier(goalAmount: number, thresholds: number[]): number {
  const exceeded = thresholds.filter((threshold) => goalAmount > threshold).length;
  return 1 + exceeded;
}

/**
 * Whether a campaign of the given tier needs manual compliance review before it
 * goes live. Tiers up to `autoApproveMaxTier` are auto-approved; higher tiers are
 * held in PENDING_REVIEW.
 */
export function tierRequiresManualReview(tier: number, autoApproveMaxTier: number): boolean {
  return tier > autoApproveMaxTier;
}
