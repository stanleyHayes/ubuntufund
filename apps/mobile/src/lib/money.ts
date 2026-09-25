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
