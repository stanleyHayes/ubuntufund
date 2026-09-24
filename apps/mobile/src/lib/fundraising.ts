const DEFAULT_ORIGIN = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.ujimora.com'

function websiteBase(origin: string) {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('The donation website is unavailable. Please try again later.')
  return base
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

/** Public campaign page on the web app; the marketing domain serves only its own landing routes. */
export function campaignShareUrl(campaign: { id: string; slug?: string }, origin = DEFAULT_ORIGIN) {
  const path = campaign.slug ? `/c/${encodeURIComponent(campaign.slug)}` : `/campaigns/${encodeURIComponent(campaign.id)}`
  return new URL(path, websiteBase(origin).origin).toString()
}
