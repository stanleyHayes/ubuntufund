import { PaymentMethod } from '@ubuntu-fund/types'
import type { UserDonation } from '@/hooks/useDonations'

/**
 * Only a completed card or mobile-money gift, with no request already open,
 * within 30 days. Wallet-funded gifts have no refund path yet (support handles
 * them), so the button would promise something the system cannot do.
 */
export function isRefundEligible(donation: UserDonation, now = new Date()): boolean {
  if (donation.status !== 'completed') return false
  if (donation.refundRequested) return false
  if (donation.paymentMethod === PaymentMethod.WALLET) return false
  const donationDate = new Date(donation.date)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return donationDate >= thirtyDaysAgo
}
