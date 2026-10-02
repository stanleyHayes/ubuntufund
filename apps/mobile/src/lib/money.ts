const formatters = new Map<string, Intl.NumberFormat>()
const plainFormatter = new Intl.NumberFormat('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Money with exactly two decimals in the given currency: 100.5 GHS is
 * 'GH₵100.50', and an unrounded float sum such as 30.299999999999997 is
 * 'GH₵30.30'. Unknown or non-ISO codes fall back to '<CODE> 1,234.50'.
 */
export function formatMoney(amount: number, currency: string | null | undefined = 'GHS'): string {
  const value = Number.isFinite(amount) ? amount : 0
  const code = (currency || 'GHS').trim().toUpperCase()
  try {
    let formatter = formatters.get(code)
    if (!formatter) {
      formatter = new Intl.NumberFormat('en-GH', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 })
      formatters.set(code, formatter)
    }
    return formatter.format(value)
  } catch {
    return `${code === 'GHS' ? 'GH₵' : code} ${plainFormatter.format(value)}`
  }
}

/** A grouped number with two decimals and no currency sign, for layouts that label the currency separately. */
export function formatAmountValue(amount: number): string {
  return plainFormatter.format(Number.isFinite(amount) ? amount : 0)
}

/**
 * A plan price as the web and marketing pricing pages show it: whole cedis
 * with no decimals, anything else with two ('GH₵3,990', 'GH₵9.99', 'GH₵332.50').
 */
export function formatPlanPrice(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0
  const minimumFractionDigits = Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2
  try {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', minimumFractionDigits, maximumFractionDigits: 2 }).format(value)
  } catch {
    return `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits, maximumFractionDigits: 2 })}`
  }
}
