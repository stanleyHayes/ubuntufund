import type { Payout } from '@ubuntu-fund/types'

export interface PayoutHistoryState {
  /** Short status label. */
  label: string
  /** What happened, when the label alone would mislead (a closed request). */
  detail?: string
  tone: 'success' | 'warning' | 'default'
  /** Caption above the net amount. */
  amountCaption: string
}

/**
 * How a payout reads in the organizer's history. A request an admin rejected
 * or the organizer cancelled is stored as FAILED with a `closure`; it must never
 * read as a failed bank transfer, and a rejection shows the admin's reason.
 */
export function payoutHistoryState(p: Pick<Payout, 'status' | 'providerStatus' | 'closure'>): PayoutHistoryState {
  if (p.closure) {
    const rejected = p.closure.kind === 'rejected'
    return {
      label: rejected ? 'Rejected' : 'Cancelled',
      detail: rejected
        ? `The admin team rejected this request: ${p.closure.reason} Nothing was sent, and the amount is back in your campaign balance.`
        : 'You cancelled this request. Nothing was sent, and the amount is back in your campaign balance.',
      tone: 'warning',
      amountCaption: 'REQUESTED NET AMOUNT (NOT SENT)',
    }
  }
  if (p.status === 'PAID') return { label: 'Completed', tone: 'success', amountCaption: 'AMOUNT RECEIVED' }
  if (p.status === 'PROCESSING' && p.providerStatus === 'otp')
    return { label: 'Awaiting authorization', tone: 'default', amountCaption: 'EXPECTED NET AMOUNT' }
  return { label: p.status.replaceAll('_', ' ').toLowerCase(), tone: 'default', amountCaption: 'EXPECTED NET AMOUNT' }
}
