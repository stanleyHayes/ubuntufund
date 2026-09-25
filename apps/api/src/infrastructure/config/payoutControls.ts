import type { PayoutsConfig } from './index.js'

/**
 * Startup warnings for payout controls that are deliberately configurable but
 * weaken segregation of duties when off. Production currently runs with
 * PAYOUT_DUAL_APPROVAL_AMOUNT=0 (single-admin approval) as an accepted risk
 * while there is one administrator; see docs/compliance/STAFF_ACCESS.md.
 */
export function payoutControlWarnings(nodeEnv: string, payouts: Pick<PayoutsConfig, 'dualApprovalAmount'>): string[] {
  const warnings: string[] = []
  if (nodeEnv === 'production' && !(payouts.dualApprovalAmount > 0))
    warnings.push(
      'PAYOUT_DUAL_APPROVAL_AMOUNT is 0: every campaign and beneficiary payout needs only one admin approval (maker-checker is off). ' +
        'Compensating controls: each payout pays only the destination it was requested against, entered by the campaign owner (or, for a beneficiary payout, the beneficiary or owner) and never by staff; recorded review notes; current-KYC, campaign-status and self-approval checks; and after-the-fact audit review. ' +
        'Set a GHS threshold once a second approving admin exists.',
    )
  return warnings
}
