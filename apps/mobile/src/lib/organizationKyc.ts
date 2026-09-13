import { adultBirthDateError, type KYCIdentityDocumentType } from '@ubuntu-fund/types'
export const emptyOrganizationKyc = () => ({
  businessName: '', registrationNumber: '', businessType: '', taxId: '', street: '', city: '', country: 'Ghana',
  fullName: '', dateOfBirth: '', nationality: 'Ghana', idNumber: '', representativeCapacity: '', ownershipExplanation: '',
  controllers: [{ fullName: '', role: 'director', country: 'Ghana', ownershipPercent: '' }],
  identityType: 'id_card' as KYCIdentityDocumentType,
  registration: '', authorization: '', identity: '', control: '', authorized: false, accurate: false,
})
export type OrganizationKycDraft = ReturnType<typeof emptyOrganizationKyc>
export function buildOrganizationKyc(d: OrganizationKycDraft) {
  const age = adultBirthDateError(d.dateOfBirth)
  if (age) throw new Error(age)
  for (const field of ['businessName', 'registrationNumber', 'businessType', 'street', 'city', 'country', 'fullName', 'nationality', 'idNumber', 'representativeCapacity'] as const) if (!d[field].trim()) throw new Error('Complete the required organization and representative details.')
  if (!d.authorized || !d.accurate) throw new Error('Confirm both declarations before submitting.')
  if (d.ownershipExplanation.trim().length < 20) throw new Error('Explain ownership and control in at least 20 characters.')
  if (!d.controllers.length || d.controllers.length > 50 || d.controllers.some(p => !p.fullName.trim() || !p.country || !['director', 'trustee', 'beneficial_owner', 'other_controller'].includes(p.role) || (p.ownershipPercent !== '' && (!Number.isFinite(Number(p.ownershipPercent)) || Number(p.ownershipPercent) < 0 || Number(p.ownershipPercent) > 100)))) throw new Error('Complete controlling-person details and use ownership percentages between 0 and 100.')
  if (![d.registration, d.authorization, d.identity].every(url => /^kyc:\/\/[a-f0-9]{24}$/i.test(url)) || (d.control && !/^kyc:\/\/[a-f0-9]{24}$/i.test(d.control))) throw new Error('Upload private registration, authorization and representative identity evidence.')
  return {
    personalInfo: { fullName: d.fullName.trim(), dateOfBirth: new Date(d.dateOfBirth).toISOString(), nationality: d.nationality, idNumber: d.idNumber.trim() },
    businessInfo: { businessName: d.businessName.trim(), registrationNumber: d.registrationNumber.trim(), businessType: d.businessType.trim(), taxId: d.taxId.trim() || undefined, registeredAddress: { street: d.street.trim(), city: d.city.trim(), country: d.country }, representativeCapacity: d.representativeCapacity.trim(), ownershipExplanation: d.ownershipExplanation.trim(), controlPersons: d.controllers.map(p => ({ fullName: p.fullName.trim(), role: p.role, country: p.country, ...(p.ownershipPercent !== '' ? { ownershipPercent: Number(p.ownershipPercent) } : {}) })) },
    documents: [{ type: 'business_registration', url: d.registration }, { type: 'authorization_letter', url: d.authorization }, { type: d.identityType, url: d.identity }, ...(d.control ? [{ type: 'ownership_register', url: d.control }] : [])],
    declaration: { authorized: d.authorized, accurate: d.accurate },
  }
}
