import type { BeneficiaryPartyType, BeneficiaryRelationship, OnBehalfPayoutArrangement } from '@ubuntu-fund/types'

/** Plain names for a campaign raised on someone else's behalf, shared by the campaign panel and publication reviews. */
export const RELATIONSHIP_LABELS: Record<BeneficiaryRelationship, string> = {
  family: 'Family member',
  community_member: 'Community member',
  patient: 'Patient',
  student: 'Student',
  client: 'Client',
  partner_organization: 'Partner organization',
  other: 'Other',
}
export const TYPE_LABELS: Record<BeneficiaryPartyType, string> = { individual: 'Person', organization: 'Organization' }
export const ARRANGEMENT_LABELS: Record<OnBehalfPayoutArrangement, string> = {
  beneficiary: 'Paid to the beneficiary',
  organization: 'Paid to the organizer',
}
