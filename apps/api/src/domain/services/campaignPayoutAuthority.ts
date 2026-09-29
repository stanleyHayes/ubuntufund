/**
 * Who may request payouts from a campaign, and whose verification, wallet and
 * payout destination a payout must match.
 *
 * Self-created campaigns: the creator, exactly as before this existed.
 *
 * Campaigns run on someone's behalf: nobody until the beneficiary has accepted.
 * After that, the account the beneficiary's consent named: themselves, or the
 * organization if they explicitly agreed it may receive the funds. Creating or
 * managing a campaign never grants payout rights on its own.
 *
 * Every payout path (request, destination, options, cancel, approval, wallet
 * settlement, automatic approval) asks this one function, so the rule cannot
 * drift between rails.
 */
export interface PayoutAuthoritySource {
  creatorId: string
  creationMode?: string | null
  onBehalf?: {
    consentStatus?: string | null
    payoutAuthorityUserId?: string | null
  } | null
}

export function payoutAuthorityOf(campaign: PayoutAuthoritySource): string | null {
  if (campaign.creationMode !== 'on_behalf') return campaign.creatorId
  if (campaign.onBehalf?.consentStatus !== 'accepted') return null
  return campaign.onBehalf.payoutAuthorityUserId || null
}

/** Fields a raw campaign query must select so {@link payoutAuthorityOf} sees the whole picture. */
export const PAYOUT_AUTHORITY_FIELDS = 'creatorId creationMode onBehalf'

export const NO_PAYOUT_AUTHORITY_MESSAGE =
  'Payouts open once the beneficiary accepts this campaign. The organizer cannot withdraw on their behalf unless the beneficiary agreed to that.'
