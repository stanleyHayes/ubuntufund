import { SubscriptionStatus, SubscriptionTier } from '@ubuntu-fund/types'
import { TONES } from './tones'
import type { PlanMap } from './subscriptionMetrics'

/**
 * Curated hues for the built-in tiers. A hue only marks a tier on its 6px dot
 * and its revenue bar: tier names are written in the theme's text colour,
 * because these dark-console hues fall below 4.5:1 as small text in light skins.
 */
const KNOWN_TIER_HUES: Record<string, string> = {
  [SubscriptionTier.FREE]: '#78909C',
  [SubscriptionTier.STARTER]: '#74909A',
  [SubscriptionTier.PRO]: TONES.maroon.text,
  [SubscriptionTier.ORGANIZATION]: '#8B6F4E',
  [SubscriptionTier.ENTERPRISE]: '#C7A24A',
}

/** One hue per tier, for both the row dot and the tier card: curated, else the plan's own accent colour. */
export function tierHue(tier: string, plans: PlanMap): string {
  return KNOWN_TIER_HUES[tier] ?? plans[tier]?.accentColor ?? '#78909C'
}

/** Status words in the theme's text tokens, which clear AA (4.5:1) in every skin and mode. */
export const STATUS_TEXT_COLOR: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.ACTIVE]: 'var(--text-success)',
  [SubscriptionStatus.TRIALING]: 'var(--text-info)',
  [SubscriptionStatus.PAST_DUE]: 'var(--text-warning)',
  [SubscriptionStatus.CANCELLED]: 'var(--text-error)',
  [SubscriptionStatus.EXPIRED]: 'text.secondary',
}
