const DEFAULT_ORIGIN = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.ujimora.com'

function websiteBase(origin: string) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('The donation website is unavailable. Please try again later.')
  return base
}

/**
 * The public handle for a campaign's donation page: its slug, or its id for
 * older campaigns created before slugs existed (the web /c/:handle routes
 * accept a 24-hex id in place of a slug).
 */
export function campaignDonationHandle(campaign: { id: string; slug?: string | null }) {
  return campaign.slug?.trim() || campaign.id
}

/** Only public campaign context crosses into the browser. Never include account tokens or donor data. */
export function fundraisingUrl(slug: string, context: { amount?: string; liveSessionId?: string } = {}, origin = DEFAULT_ORIGIN) {
  const base = websiteBase(origin)
  if (!slug.trim()) throw new Error('This campaign does not have a donation link yet.')
  const url = new URL(`/c/${encodeURIComponent(slug)}/donate`, base.origin)
  const amount = Number(context.amount)
  if (Number.isFinite(amount) && amount > 0 && amount === Math.round(amount * 100) / 100) url.searchParams.set('amount', String(amount))
  if (context.liveSessionId && /^[a-f0-9]{24}$/i.test(context.liveSessionId)) url.searchParams.set('liveSessionId', context.liveSessionId)
  return url.toString()
}

/** Wallet balances only fund donations, so iOS top-ups follow the same external-browser rule as donations. */
export function walletFundingUrl(origin = DEFAULT_ORIGIN) {
  return new URL('/wallet', websiteBase(origin).origin).toString()
}

/**
 * The watch screen's line for the host's session goal (a stretch goal for the
 * broadcast, distinct from the campaign goal), or null when none was set.
 * Progress is left out while the host hides amounts (`amountRaised` null).
 */
export function sessionGoalLine(view: { targetAmount?: number | null; amountRaised: number | null; currency?: string }): string | null {
  const goal = Number(view.targetAmount)
  if (!Number.isFinite(goal) || goal <= 0) return null
  const label = `Session goal: ${view.currency || 'GHS'} ${goal.toLocaleString()}`
  if (view.amountRaised === null || !Number.isFinite(view.amountRaised)) return label
  return `${label} · ${Math.min(100, Math.round((view.amountRaised / goal) * 100))}% reached`
}

/** Public campaign page on the web app; the marketing domain serves only its own landing routes. */
export function campaignShareUrl(campaign: { id: string; slug?: string }, origin = DEFAULT_ORIGIN) {
  const path = campaign.slug ? `/c/${encodeURIComponent(campaign.slug)}` : `/campaigns/${encodeURIComponent(campaign.id)}`
  return new URL(path, websiteBase(origin).origin).toString()
}

/** Absolute link to a public page on the web app (share text), following EXPO_PUBLIC_WEB_URL. */
export function webUrl(path: string, origin = DEFAULT_ORIGIN) {
  return new URL(path, websiteBase(origin).origin).toString()
}
