/**
 * Campaigns an eligible account runs on behalf of someone else.
 *
 * Four roles stay separate: the creator (who made the campaign, immutable), the
 * manager (who administers it: the creator account and its org admins/editors),
 * the beneficiary (who the campaign is for) and the payout authority (who may
 * request payouts). Managing a campaign never implies payout authority.
 */
export type CampaignCreationMode = 'self' | 'on_behalf'

export type BeneficiaryPartyType = 'individual' | 'organization'

/** NOT_REQUIRED is reserved for self-created campaigns and admin exemptions. */
export type OnBehalfConsentStatus = 'not_required' | 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked'

/**
 * Who receives the money once the beneficiary consents. The organization can
 * only receive it when the beneficiary explicitly accepted that arrangement.
 */
export type OnBehalfPayoutArrangement = 'beneficiary' | 'organization'

export const BENEFICIARY_RELATIONSHIPS = [
  'family',
  'community_member',
  'patient',
  'student',
  'client',
  'partner_organization',
  'other',
] as const
export type BeneficiaryRelationship = (typeof BENEFICIARY_RELATIONSHIPS)[number]

/** Sent with `POST /campaigns` to create a campaign on someone's behalf. */
export interface OnBehalfCampaignInput {
  beneficiaryType: BeneficiaryPartyType
  /** Public display name (shown to donors as "on behalf of …"). */
  beneficiaryName: string
  /** Where the invitation goes. Never shown to donors or returned to the manager in full. */
  beneficiaryEmail: string
  relationship: BeneficiaryRelationship
  /** Why the organizer is raising funds for this beneficiary. */
  reason: string
  payoutArrangement: OnBehalfPayoutArrangement
}

/**
 * `PUT /campaigns/:id/beneficiary`. The new name and reason are public text,
 * admitted like a new campaign's: `automatedReviewConsent` (default off) is
 * permission to send the campaign's public text to automated screening.
 * Without it, or when screening does not clear it, our team checks it first.
 */
export interface ChangeBeneficiaryInput extends OnBehalfCampaignInput {
  automatedReviewConsent?: boolean
}

/**
 * What makes a campaign that is not public yet go live from here, for the
 * people running it (server-computed from the campaign's own rules):
 * - `content_check`: our team checks the content first; a held invitation is sent after;
 * - `name_beneficiary`: the content check waits, but its invitation was withdrawn when our
 *   team declined the campaign (it is back in review now): the organizer names the
 *   beneficiary again, and then our team can finish the check;
 * - `consent`: the beneficiary's acceptance publishes it;
 * - `staff_after_consent`: once the beneficiary accepts, our team checks it before it goes live;
 * - `staff`: it waits for our team now.
 */
export type OnBehalfNextStep = 'content_check' | 'name_beneficiary' | 'consent' | 'staff_after_consent' | 'staff'

/** `PUT /campaigns/:id/beneficiary` result. */
export interface ChangeBeneficiaryResult {
  /** True when the new invitation waits for our team's content check. */
  invitationHeld: boolean
  nextStep?: OnBehalfNextStep
}

/** The public part of an on-behalf campaign: enough for donors to know who benefits. */
export interface CampaignOnBehalfSummary {
  beneficiaryName: string
  beneficiaryType: BeneficiaryPartyType
  /** True once the beneficiary has accepted the campaign. */
  beneficiaryConfirmed: boolean
}

/** What the signed-in viewer may do with a campaign. Server-computed; UI hiding is not authorization. */
export interface CampaignViewerAccess {
  manage: boolean
  beneficiary: boolean
  payoutAuthority: boolean
  thankDonors: boolean
}

/**
 * `held`: written but not sent. A campaign whose content waits for a staff
 * check keeps its invitation until staff clear the content, so nothing
 * unreviewed reaches the invited address.
 */
export type BeneficiaryInvitationStatus = 'held' | 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked' | 'superseded'

/** `GET /campaigns/:id/beneficiary`: for the manager, the linked beneficiary and staff. */
export interface CampaignBeneficiaryDetails {
  campaignId: string
  creationMode: CampaignCreationMode
  beneficiaryType: BeneficiaryPartyType
  beneficiaryName: string
  relationship: BeneficiaryRelationship
  reason: string
  payoutArrangement: OnBehalfPayoutArrangement
  consentStatus: OnBehalfConsentStatus
  consentAt?: string
  /** Whether an Ujimora account has accepted and is linked. */
  linked: boolean
  /** Masked, e.g. "a•••@example.com". The full address is never returned. */
  invitationEmailHint?: string
  invitationStatus?: BeneficiaryInvitationStatus
  /** Absent for an invitation never sent: `held`, or withdrawn (`superseded`) while it was held. */
  invitationSentAt?: string
  invitationExpiresAt?: string
  payoutAuthority: 'beneficiary' | 'organization' | 'none'
  publicationRequiresConsent: boolean
  donationsRequireConsent: boolean
  canResendInvitation: boolean
  /** Before acceptance, before any money, while not blocked and before the end date. */
  canChangeBeneficiary: boolean
  canRevokeConsent: boolean
  /**
   * For managers and staff, while the campaign is pending review: what makes
   * it go live from here. Absent once it is public, or when it cannot go live
   * for this beneficiary (declined, withdrawn, ended).
   */
  nextStep?: OnBehalfNextStep
  /** Viewer's relationship to the campaign. */
  viewer: { manager: boolean; beneficiary: boolean; admin: boolean }
  organizerName?: string
}

/** `POST /beneficiary-invitations/preview`: what the invited person sees before deciding. */
export interface BeneficiaryInvitationPreview {
  status: BeneficiaryInvitationStatus
  expiresAt: string
  campaignTitle: string
  campaignSummary: string
  goalAmount: number
  currency: string
  organizerName: string
  beneficiaryName: string
  beneficiaryType: BeneficiaryPartyType
  relationship: BeneficiaryRelationship
  reason: string
  payoutArrangement: OnBehalfPayoutArrangement
  /** The account type needed to accept: individuals use a personal account, organizations an organization account. */
  requiredAccountType: BeneficiaryPartyType
  consentVersion: string
}

/** A campaign someone else runs for the signed-in beneficiary. */
export interface BeneficiaryCampaignListItem {
  id: string
  slug?: string
  title: string
  status: string
  raisedAmount: number
  goalAmount: number
  currency: string
  organizerName: string
  consentStatus: OnBehalfConsentStatus
  payoutArrangement: OnBehalfPayoutArrangement
  payoutAuthority: boolean
  endDate: string
}

/** Consent text version. Bump when the consent wording changes. */
export const BENEFICIARY_CONSENT_VERSION = '2026-09-29'
