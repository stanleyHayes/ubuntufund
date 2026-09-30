import {
  BENEFICIARY_RELATIONSHIPS,
  type BeneficiaryPartyType,
  type BeneficiaryRelationship,
  type CampaignBeneficiaryDetails,
  type OnBehalfCampaignInput,
  type OnBehalfConsentStatus,
  type OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types'

/**
 * Campaigns run on someone else's behalf: labels, validation and the pending
 * invitation token. The server authorizes every action; these only explain it.
 */

export const RELATIONSHIP_LABELS: Record<BeneficiaryRelationship, string> = {
  family: 'Family member',
  community_member: 'Community member',
  patient: 'Patient',
  student: 'Student',
  client: 'Client',
  partner_organization: 'Partner organization',
  other: 'Other',
}

export const RELATIONSHIP_OPTIONS = BENEFICIARY_RELATIONSHIPS.map((value) => ({ value, label: RELATIONSHIP_LABELS[value] }))

export const partyLabel = (type: BeneficiaryPartyType) => (type === 'organization' ? 'Organization' : 'Person')

/** The beneficiary block as the form holds it: the relationship starts unset. */
export interface BeneficiaryDraft {
  beneficiaryType: BeneficiaryPartyType
  beneficiaryName: string
  beneficiaryEmail: string
  relationship: BeneficiaryRelationship | ''
  reason: string
  payoutArrangement: OnBehalfPayoutArrangement
}

export type BeneficiaryField = 'beneficiaryName' | 'beneficiaryEmail' | 'relationship' | 'reason'
export type BeneficiaryErrors = Partial<Record<BeneficiaryField, string>>

export const EMPTY_BENEFICIARY: BeneficiaryDraft = {
  beneficiaryType: 'individual',
  beneficiaryName: '',
  beneficiaryEmail: '',
  relationship: '',
  reason: '',
  payoutArrangement: 'beneficiary',
}

export const BENEFICIARY_LIMITS = { name: 120, email: 254, reason: 1000 } as const

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Mirrors the API's rules, so problems show before submitting. */
export function validateBeneficiary(draft: BeneficiaryDraft, ownEmail?: string): BeneficiaryErrors {
  const errors: BeneficiaryErrors = {}
  const name = draft.beneficiaryName.trim()
  if (!name) errors.beneficiaryName = 'Enter the name donors will see'
  else if (name.length < 2) errors.beneficiaryName = 'Use at least 2 characters'
  else if (name.length > BENEFICIARY_LIMITS.name) errors.beneficiaryName = `Use at most ${BENEFICIARY_LIMITS.name} characters`
  const email = draft.beneficiaryEmail.trim()
  if (!email) errors.beneficiaryEmail = 'Enter their email address'
  else if (!EMAIL_RE.test(email) || email.length > BENEFICIARY_LIMITS.email) errors.beneficiaryEmail = 'Enter a valid email address'
  else if (ownEmail && email.toLowerCase() === ownEmail.trim().toLowerCase()) errors.beneficiaryEmail = 'Use their own email address, not yours'
  if (!draft.relationship) errors.relationship = 'Choose how you know them'
  const reason = draft.reason.trim()
  if (!reason) errors.reason = 'Explain why you are raising money for them'
  else if (reason.length < 10) errors.reason = 'Use at least 10 characters'
  else if (reason.length > BENEFICIARY_LIMITS.reason) errors.reason = `Use at most ${BENEFICIARY_LIMITS.reason} characters`
  return errors
}

export function beneficiaryInput(draft: BeneficiaryDraft): OnBehalfCampaignInput {
  return {
    beneficiaryType: draft.beneficiaryType,
    beneficiaryName: draft.beneficiaryName.trim(),
    beneficiaryEmail: draft.beneficiaryEmail.trim(),
    relationship: draft.relationship as BeneficiaryRelationship,
    reason: draft.reason.trim(),
    payoutArrangement: draft.payoutArrangement,
  }
}

/** Who receives the money, in plain words. */
export function payoutArrangementText(arrangement: OnBehalfPayoutArrangement, beneficiaryName: string, organizerName?: string): string {
  return arrangement === 'organization'
    ? `${organizerName || 'The organizer'}, on behalf of ${beneficiaryName}`
    : `${beneficiaryName}, into their own verified account`
}

export type ChipTone = 'default' | 'success' | 'warning' | 'error' | 'info'

export const CONSENT_STATUS: Record<OnBehalfConsentStatus, { label: string; tone: ChipTone }> = {
  pending: { label: 'Waiting for acceptance', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  declined: { label: 'Declined', tone: 'error' },
  expired: { label: 'Invitation expired', tone: 'default' },
  revoked: { label: 'Consent withdrawn', tone: 'error' },
  not_required: { label: 'Not required', tone: 'default' },
}

export function consentExplanation(status: OnBehalfConsentStatus, name: string): string {
  switch (status) {
    case 'pending': return `We emailed ${name} an invitation. They have not answered yet.`
    case 'accepted': return `${name} confirmed that this campaign is run for them.`
    case 'declined': return `${name} declined this campaign.`
    case 'expired': return `The invitation expired before ${name} answered. Send it again to give them more time.`
    case 'revoked': return `${name} withdrew their consent.`
    default: return ''
  }
}

/** What waits for the beneficiary's answer, from the rules copied onto the campaign. */
export function consentGateText(details: Pick<CampaignBeneficiaryDetails, 'consentStatus' | 'beneficiaryName' | 'publicationRequiresConsent' | 'donationsRequireConsent'>): string | null {
  const name = details.beneficiaryName
  if (details.consentStatus === 'accepted') return null
  if (details.consentStatus === 'declined' || details.consentStatus === 'revoked') return `The campaign cannot collect or pay out money for ${name}.`
  if (details.publicationRequiresConsent && details.donationsRequireConsent) return `The campaign cannot go live or collect donations until ${name} accepts.`
  if (details.publicationRequiresConsent) return `The campaign cannot go live until ${name} accepts.`
  if (details.donationsRequireConsent) return `Donations stay closed until ${name} accepts.`
  return `Payouts wait until ${name} accepts.`
}

export function payoutAuthorityText(details: Pick<CampaignBeneficiaryDetails, 'payoutAuthority' | 'consentStatus' | 'beneficiaryName' | 'organizerName'>): string {
  const name = details.beneficiaryName
  if (details.payoutAuthority === 'beneficiary') return `${name} can request payouts.`
  if (details.payoutAuthority === 'organization') return `${details.organizerName || 'The organizer'} can request payouts, as ${name} agreed.`
  return details.consentStatus === 'declined' || details.consentStatus === 'revoked'
    ? 'Nobody can request payouts. Payouts are paused.'
    : `Nobody can request payouts until ${name} accepts.`
}

// ── Pending invitation link ─────────────────────────────────────────────────
// Kept only while a signed-out visitor signs in, in this tab, so the page can
// bring the invitation back. Removed once it is accepted, declined or unusable.
/**
 * What waits for the beneficiary's acceptance on a new campaign under the
 * current settings. Unknown settings (an older API) read as the strict default.
 * Payouts always wait for acceptance; that is not a setting.
 */
export function creationGateText(flags?: { publicationRequiresConsent?: boolean; donationsRequireConsent?: boolean }): string {
  const publication = flags?.publicationRequiresConsent ?? true
  const donations = flags?.donationsRequireConsent ?? true
  if (publication && donations) return 'The beneficiary must accept before the campaign can go live or collect donations.'
  if (publication) return 'The beneficiary must accept before the campaign can go live. Nothing is paid out until they do.'
  if (donations) return 'The beneficiary must accept before the campaign can collect donations. Nothing is paid out until they do.'
  return 'The campaign can collect donations before the beneficiary accepts, but nothing is paid out until they do.'
}

const INVITATION_TOKEN_KEY = 'uf_beneficiary_invitation'

export const isInvitationToken = (token: string) => /^[a-f0-9]{64}$/.test(token)

export function readStoredInvitationToken(): string {
  try { return sessionStorage.getItem(INVITATION_TOKEN_KEY) ?? '' } catch { return '' }
}

export function storeInvitationToken(token: string): void {
  try { sessionStorage.setItem(INVITATION_TOKEN_KEY, token) } catch { /* storage unavailable */ }
}

export function forgetInvitationToken(): void {
  try { sessionStorage.removeItem(INVITATION_TOKEN_KEY) } catch { /* storage unavailable */ }
}
