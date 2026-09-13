import { adultBirthDateError, KYC_IDENTITY_DOCUMENT_OPTIONS, type KYCIdentityDocumentType } from '@ubuntu-fund/types'
export interface KycDraft {
  identityDocumentType: KYCIdentityDocumentType
  fullName: string; dateOfBirth: string; nationality: string; idNumber: string
  country: string; state: string; city: string; street: string; postalCode: string
  proofMethod: 'document' | 'ghana_post_gps'; gpsAddress: string
  idFront: string; idBack: string; addressDoc: string; selfie: string
}
export const emptyKycDraft: KycDraft = {
  identityDocumentType: 'id_card',
  fullName: '', dateOfBirth: '', nationality: '', idNumber: '', country: 'Ghana', state: '', city: '', street: '', postalCode: '',
  proofMethod: 'ghana_post_gps', gpsAddress: '', idFront: '', idBack: '', addressDoc: '', selfie: '',
}
export function validateKycStep(d: KycDraft, step: number): string | null {
  if (step === 0) {
    if (!d.fullName.trim() || !d.nationality || !d.idNumber.trim()) return 'Enter your full name, nationality and ID number.'
    const ageError = adultBirthDateError(d.dateOfBirth)
    if (ageError) return ageError
  }
  if (step === 1) {
    if (!KYC_IDENTITY_DOCUMENT_OPTIONS.some(option => option.value === d.identityDocumentType)) return 'Choose an identity document type.'
    if (!d.idFront || (d.identityDocumentType !== 'passport' && !d.idBack)) return d.identityDocumentType === 'passport' ? 'Upload the photo page of your passport.' : 'Upload the front and back of your ID.'
  }
  if (step === 2) {
    if (!d.country || !d.city.trim()) return 'Choose your country and enter or select your city.'
    if (d.proofMethod === 'ghana_post_gps') {
      if (d.country !== 'Ghana' || !/^[A-Z]{2}-[0-9]{3,5}-[0-9]{4}$/.test(d.gpsAddress.trim().toUpperCase())) return 'Enter a valid GhanaPost GPS address, for example GA-123-4567.'
    } else if (!d.street.trim() || !d.addressDoc) return 'Enter your street and upload a utility bill or bank statement.'
  }
  if (step === 3 && !d.selfie) return 'Upload a clear selfie holding your ID.'
  return null
}
export function buildKycSubmission(d: KycDraft) {
  for (let i = 0; i < 4; i++) { const error = validateKycStep(d, i); if (error) throw new Error(error) }
  return {
    personalInfo: {
      fullName: d.fullName.trim(), dateOfBirth: new Date(d.dateOfBirth).toISOString(), nationality: d.nationality, idNumber: d.idNumber.trim(),
      address: { city: d.city.trim(), state: d.state, country: d.country, proofMethod: d.proofMethod,
        ...(d.proofMethod === 'ghana_post_gps' ? { gpsAddress: d.gpsAddress.trim().toUpperCase() } : { street: d.street.trim(), postalCode: d.postalCode.trim() }) },
    },
    documents: [
      { type: d.identityDocumentType, url: d.idFront },
      ...(d.identityDocumentType !== 'passport' ? [{ type: d.identityDocumentType, url: d.idBack }] : []),
      ...(d.proofMethod === 'document' ? [{ type: 'utility_bill', url: d.addressDoc }] : []),
      { type: 'selfie', url: d.selfie },
    ],
  }
}

export function changeKycIdentityType(draft: KycDraft, identityDocumentType: KYCIdentityDocumentType): KycDraft {
  return draft.identityDocumentType === identityDocumentType ? draft : { ...draft, identityDocumentType, idFront: '', idBack: '', selfie: '' }
}
