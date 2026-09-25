/** The fields of a history row the refund rule reads. */
export interface RefundableDonation {
  status: string
  refundRequested?: boolean
  paymentMethod?: string
  date?: string
  createdAt?: string
}

/**
 * Same rule as web: a completed card or mobile-money gift with no request
 * open, within 30 days. Wallet-funded gifts have no refund path yet.
 */
export function canRequestRefund(d: RefundableDonation, now = Date.now()) {
  if (d.status !== 'completed' || d.refundRequested || d.paymentMethod === 'wallet') return false
  const when = new Date(d.date ?? d.createdAt ?? '').getTime()
  return Number.isFinite(when) && now - when <= 30 * 24 * 60 * 60 * 1000
}
