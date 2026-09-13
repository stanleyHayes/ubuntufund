/** Only public campaign context crosses into the browser. Never include account tokens or donor data. */
export function fundraisingUrl(slug: string, context: { amount?: string; liveSessionId?: string } = {}, origin = process.env.EXPO_PUBLIC_WEB_URL || 'https://app.ujimora.com') {
  const base = new URL(origin)
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('The donation website is unavailable. Please try again later.')
  if (!slug.trim()) throw new Error('This campaign does not have a donation link yet.')
  const url = new URL(`/c/${encodeURIComponent(slug)}/donate`, base.origin)
  const amount = Number(context.amount)
  if (Number.isFinite(amount) && amount > 0 && amount === Math.round(amount * 100) / 100) url.searchParams.set('amount', String(amount))
  if (context.liveSessionId && /^[a-f0-9]{24}$/i.test(context.liveSessionId)) url.searchParams.set('liveSessionId', context.liveSessionId)
  return url.toString()
}
