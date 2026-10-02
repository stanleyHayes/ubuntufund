import type {
  BeneficiaryCampaignListItem,
  Campaign,
  CampaignBeneficiaryDetails,
  OnBehalfConsentStatus,
} from '@ubuntu-fund/types'

type AccessSource = Pick<Campaign, 'creatorId' | 'viewerAccess'>

/**
 * Payout and cashout controls follow the server's payout authority, never "is
 * the creator": running a campaign for someone else does not let the organizer
 * withdraw. The creator check only covers an API that predates `viewerAccess`.
 */
export function hasPayoutAuthority(campaign: AccessSource, userId?: string | null): boolean {
  if (!userId) return false
  return campaign.viewerAccess ? campaign.viewerAccess.payoutAuthority : campaign.creatorId === userId
}

/** The Manage screen is for the owner, co-managers, the payout authority and a consenting beneficiary. */
export function canOpenManagement(campaign: AccessSource, userId?: string | null): boolean {
  if (!userId) return false
  if (campaign.creatorId === userId) return true
  const access = campaign.viewerAccess
  return !!access && (access.manage || access.payoutAuthority || access.thankDonors)
}

/** Hiding the entry is a convenience; the API authorizes every thank-you call itself. */
export function canThankDonors(campaign: Pick<Campaign, 'viewerAccess'>): boolean {
  return !!campaign.viewerAccess?.thankDonors
}

type ConsentView = Pick<CampaignBeneficiaryDetails, 'consentStatus' | 'payoutAuthority' | 'payoutArrangement'>

/**
 * The read-only line shown instead of cashout to someone who manages the
 * campaign but cannot request payouts. Without the beneficiary details (an
 * older API or a failed read) it falls back to the public summary.
 */
export function payoutNote(campaign: Pick<Campaign, 'onBehalf'>, details?: ConsentView | null): string {
  const onBehalf = campaign.onBehalf
  if (!onBehalf) return 'Only the campaign owner’s account can request payouts.'
  const consent = details?.consentStatus ?? (onBehalf.beneficiaryConfirmed ? 'accepted' : 'pending')
  if (consent === 'declined' || consent === 'revoked') return 'Payouts are paused.'
  if (consent !== 'accepted' && consent !== 'not_required') {
    return details?.payoutArrangement === 'organization' ? 'Payouts start after the beneficiary accepts.' : 'Payouts go to the beneficiary after they accept.'
  }
  if (!details) return 'Payouts go to the account the beneficiary agreed to.'
  if (details.payoutAuthority === 'beneficiary') return 'Payouts go to the beneficiary.'
  if (details.payoutAuthority === 'organization') return 'Payouts go to the organization account that runs this campaign.'
  return 'Payouts are paused.'
}

const MANAGER_CONSENT: Record<OnBehalfConsentStatus, string> = {
  pending: 'Waiting for the beneficiary to accept',
  accepted: 'Accepted by the beneficiary',
  declined: 'Declined by the beneficiary',
  expired: 'The invitation expired before the beneficiary answered',
  revoked: 'The beneficiary withdrew their consent',
  not_required: 'Beneficiary confirmation is not required',
}

const BENEFICIARY_CONSENT: Record<OnBehalfConsentStatus, string> = {
  pending: 'Waiting for your answer',
  accepted: 'You accepted this campaign',
  declined: 'You declined this campaign',
  expired: 'Your invitation expired',
  revoked: 'You withdrew your consent',
  not_required: 'Your confirmation is not required',
}

export function consentLabel(status: OnBehalfConsentStatus, perspective: 'manager' | 'beneficiary'): string {
  return (perspective === 'beneficiary' ? BENEFICIARY_CONSENT : MANAGER_CONSENT)[status] ?? 'Status unavailable'
}

/** Where the money goes, told to the beneficiary on "Campaigns run for you". */
export function beneficiaryPayoutLine(item: Pick<BeneficiaryCampaignListItem, 'consentStatus' | 'payoutAuthority' | 'payoutArrangement' | 'organizerName'>): string {
  if (item.payoutAuthority) return 'Payouts come to you.'
  if (item.consentStatus === 'pending') return 'Accept or decline from the invitation email.'
  if (item.consentStatus === 'accepted' && item.payoutArrangement === 'organization') return `You agreed that payouts go to ${item.organizerName}.`
  return 'Payouts are paused.'
}

export const fundsRaisedFor = (beneficiaryName: string) => `Funds raised for ${beneficiaryName}`

/**
 * Named beneficiary and destination on one screen before a payout request on
 * a campaign run for someone else, so the money cannot be sent to the wrong
 * place by mistake.
 */
export function cashoutConfirmPrompt(input: {
  beneficiaryName: string
  destination: string
  recipient?: { accountName: string; last4: string } | null
  amount: number
  receive: number
}): { title: string; message: string; confirmLabel: string } {
  const to = input.destination === 'ujimora_wallet' ? 'your Ujimora Wallet'
    : input.recipient ? `${input.recipient.accountName} · ending ${input.recipient.last4}` : 'your verified payout account'
  return {
    title: 'Request this cashout?',
    message: [
      `${fundsRaisedFor(input.beneficiaryName)}.`,
      `Paid to: ${to}.`,
      `Amount GHS ${input.amount.toFixed(2)} · you receive GHS ${input.receive.toFixed(2)}.`,
      'Check that this is where the money should go before you continue.',
    ].join('\n'),
    confirmLabel: 'Request cashout',
  }
}

/**
 * The invitation line on the Manage screen. A `held` invitation waits for our
 * team to check the campaign's content, so it was never sent. The newest one
 * `superseded` while consent is still pending was withdrawn (the campaign was
 * declined, ended or closed): nothing is waiting for the beneficiary.
 */
export function invitationSummary(details: (Pick<CampaignBeneficiaryDetails, 'invitationEmailHint' | 'invitationStatus' | 'invitationExpiresAt'> & Partial<Pick<CampaignBeneficiaryDetails, 'consentStatus'>>) | null | undefined, formatDate: (iso?: string) => string): string {
  if (details?.invitationStatus === 'superseded' && details.consentStatus === 'pending') return 'No invitation is waiting for the beneficiary.'
  if (!details?.invitationEmailHint) return ''
  if (details.invitationStatus === 'held') return `Invitation to ${details.invitationEmailHint} is sent once our team has checked the campaign`
  if (details.invitationStatus !== 'pending' && details.invitationStatus !== 'expired') return ''
  return `Invitation sent to ${details.invitationEmailHint}${details.invitationExpiresAt ? ` · ${details.invitationStatus === 'expired' ? 'expired' : 'expires'} ${formatDate(details.invitationExpiresAt)}` : ''}`
}

/**
 * What makes the campaign go live from here, on the Manage screen (the
 * server's `nextStep`). Never promises more than the campaign's rules do. A
 * content check in progress is told by the invitation line instead.
 */
export function nextStepLine(details: Pick<CampaignBeneficiaryDetails, 'nextStep' | 'beneficiaryName'> | null | undefined): string {
  if (!details) return ''
  switch (details.nextStep) {
    // Its invitation was withdrawn when the campaign was declined, so our team cannot finish the check yet.
    case 'name_beneficiary': return 'Name the beneficiary again so our team can finish checking the campaign.'
    case 'consent': return `It goes live as soon as ${details.beneficiaryName} accepts.`
    case 'staff_after_consent': return `When ${details.beneficiaryName} accepts, our team checks it before it goes live.`
    case 'staff': return 'Our team is checking it before it goes live. We will let you know when it has been reviewed.'
    default: return ''
  }
}
