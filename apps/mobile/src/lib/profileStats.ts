/** Shape of the money figures GET /profile returns: one entry per currency. */
export interface ProfileMoneyStats {
  campaignsCreated?: number
  donatedByCurrency?: { currency: string; net: number }[]
  raisedByCurrency?: { currency: string; raised: number }[]
}

const SYMBOLS: Record<string, string> = { GHS: 'GH₵', USD: 'US$', GBP: '£', EUR: '€', NGN: '₦', KES: 'KSh' }

/** Compact, per-currency amount such as "GH₵ 1.2K"; currencies are never added together. */
export function formatCompactMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? currency
  if (amount >= 1_000_000) return `${symbol} ${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `${symbol} ${(amount / 1_000).toFixed(1)}K`
  return `${symbol} ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`
}

/** "GH₵ 100 · US$ 30", or GH₵ 0 when there is nothing to show. */
export function formatMoneyByCurrency(entries: { currency: string; amount: number }[] | undefined): string {
  const shown = (entries ?? []).filter(entry => Number.isFinite(entry.amount) && entry.amount > 0)
  return shown.length ? shown.map(entry => formatCompactMoney(entry.amount, entry.currency)).join(' · ') : formatCompactMoney(0, 'GHS')
}

export function profileStatTiles(stats: ProfileMoneyStats | null): { value: string; label: string }[] {
  return [
    { value: String(stats?.campaignsCreated ?? 0), label: 'Campaigns' },
    { value: formatMoneyByCurrency(stats?.donatedByCurrency?.map(entry => ({ currency: entry.currency, amount: entry.net }))), label: 'Donated' },
    { value: formatMoneyByCurrency(stats?.raisedByCurrency?.map(entry => ({ currency: entry.currency, amount: entry.raised }))), label: 'Raised' },
  ]
}
