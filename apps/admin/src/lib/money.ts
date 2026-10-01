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

/** A GHS amount in whole pesewas, rounded as checkout charges it (apps/api Money.ts toMinorUnits). */
export function toPesewas(amount: number): number {
  return Math.round(amount * 100)
}

/** A yearly GHS price per month, in whole pesewas. */
export function yearlyPerMonthPesewas(priceYearly: number): number {
  return Math.round(toPesewas(priceYearly) / 12)
}

/**
 * A plan price in the admin's 'GH₵ 1,500' style: en-GH grouping, no decimals
 * for a whole amount and exactly two otherwise ('GH₵ 9.99', 'GH₵ 9,999.90').
 */
export function formatPlanPrice(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2
  return `GH₵ ${amount.toLocaleString('en-GH', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`
}

/** Whole pesewas as cedis with exactly two decimals ('GH₵ 372.48'), for figures summed in pesewas. */
export function formatPesewas(pesewas: number): string {
  return `GH₵ ${(pesewas / 100).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
