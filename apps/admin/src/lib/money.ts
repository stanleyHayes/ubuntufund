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
