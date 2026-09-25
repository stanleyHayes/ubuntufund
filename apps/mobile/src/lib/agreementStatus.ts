import { hasCurrentLegalAcceptance, LEGAL_ACCEPTANCE_VERSION, type LegalAcceptanceInput } from '@ubuntu-fund/types'
import { api } from './api'

/** GET /profile/legal-acceptance: the API's view, which outranks the bundled constant. */
export interface LegalStatus {
  current: boolean
  requiredVersion: string
}

export async function fetchLegalStatus(): Promise<LegalStatus | null> {
  try {
    const status = await api.get<Partial<LegalStatus>>('/profile/legal-acceptance')
    return typeof status?.current === 'boolean' && typeof status.requiredVersion === 'string'
      ? { current: status.current, requiredVersion: status.requiredVersion }
      : null
  } catch {
    return null
  }
}

/**
 * - hidden: signed out, or the agreement is current.
 * - review: the user can review and accept in the app.
 * - update-app: the API requires a version this build does not ship the text
 *   for, so the user must update the app (or accept on the website) first.
 */
export type AgreementNotice = 'hidden' | 'review' | 'update-app'

export function agreementNotice(isAuthenticated: boolean, local: LegalAcceptanceInput | null | undefined, status: LegalStatus | null): AgreementNotice {
  if (!isAuthenticated) return 'hidden'
  if (!status) return hasCurrentLegalAcceptance(local) ? 'hidden' : 'review'
  if (status.current) return 'hidden'
  return status.requiredVersion === LEGAL_ACCEPTANCE_VERSION ? 'review' : 'update-app'
}
