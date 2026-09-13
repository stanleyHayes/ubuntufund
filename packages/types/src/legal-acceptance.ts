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
