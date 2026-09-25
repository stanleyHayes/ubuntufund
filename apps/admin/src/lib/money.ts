/**
 * Format an amount in its own currency. The shared UI formatter always renders
 * GH₵, which would mislabel any non-GHS amount in staff views.
 */
export function formatMoney(amount: number, currency = 'GHS'): string {
  const code = (currency || 'GHS').toUpperCase()
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${code} ${amount.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }
}

/** Assets the API settles at a non-ISO precision (mirrors apps/api Money.ts). */
const ASSET_MINOR_EXPONENT: Record<string, number> = { USDT: 6, USDC: 6, BTC: 8 }

/** Minor-unit exponent for a currency, as the API stores it (ISO 4217; default 2). */
export function minorUnitExponent(currency = 'GHS'): number {
  const code = (currency || 'GHS').toUpperCase()
  if (code in ASSET_MINOR_EXPONENT) return ASSET_MINOR_EXPONENT[code]
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/** Round a major-unit amount to its currency's minor units (avoids 100 - 40.1 = 59.900000000000006). */
export function roundMoney(amount: number, currency = 'GHS'): number {
  const factor = 10 ** minorUnitExponent(currency)
  return Math.round(amount * factor) / factor
}

/** Integer minor units (as the API stores them) to a major-unit amount. */
export function fromMinorUnits(minor: number, currency = 'GHS'): number {
  return roundMoney(minor / 10 ** minorUnitExponent(currency), currency)
}
