/** Bump only when users must acknowledge materially changed account/content terms. */
export const LEGAL_ACCEPTANCE_VERSION = '2026-09-12'
export interface LegalAcceptanceInput {
  version: string
  acceptedTerms: boolean
  ageConfirmed: boolean
}
export interface LegalAcceptanceRecord extends LegalAcceptanceInput {
  acceptedAt: Date
}
export function hasCurrentLegalAcceptance(value?: LegalAcceptanceInput | null): boolean {
  return value?.version === LEGAL_ACCEPTANCE_VERSION && value.acceptedTerms === true && value.ageConfirmed === true
}

/**
 * Just-in-time notice shown where identity documents and selfies are collected
 * (Ghana Data Protection Act 2012, s.27; Play user-data prominent disclosure).
 * Keep consistent with the Privacy Policy's identity/KYC sections.
 */
export const KYC_COLLECTION_NOTICE =
  'Ujimora uses your name, date of birth, ID number, identity document images, address details and selfie only to verify your identity, prevent fraud and meet payment-partner and anti-money-laundering obligations. Documents are stored privately and are visible only to you and authorised Ujimora review staff; they may be shared with payment or verification partners or authorities where the law requires. Identity records may be retained after account closure where a specific legal obligation applies. You can ask for access or correction in Settings, or email legal@ujimora.com.'
export const KYC_COLLECTION_ACKNOWLEDGEMENT = 'I confirm this information is accurate and I have read how my identity information is used.'
