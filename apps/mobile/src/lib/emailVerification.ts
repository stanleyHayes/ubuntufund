import { api } from './api'

export interface EmailVerificationStatus {
  emailVerified: boolean
  deliveryConfigured: boolean
}

/** Null when the status cannot be read; callers then show nothing. */
export async function loadEmailVerification(): Promise<EmailVerificationStatus | null> {
  try {
    const status = await api.get<Partial<EmailVerificationStatus>>('/email-verification')
    return typeof status?.emailVerified === 'boolean' ? { emailVerified: status.emailVerified, deliveryConfigured: status.deliveryConfigured === true } : null
  } catch {
    return null
  }
}

/** Only worth prompting when the member can act: unverified and email delivery works. */
export function shouldPromptVerification(status: EmailVerificationStatus | null): boolean {
  return !!status && !status.emailVerified && status.deliveryConfigured
}

/** Returns the message to show after asking for a link. */
export async function requestVerificationLink(): Promise<{ verified: boolean; message: string }> {
  const result = await api.post<{ emailVerified: boolean }>('/email-verification', {})
  return result?.emailVerified
    ? { verified: true, message: 'Your email is already verified.' }
    : { verified: false, message: 'Check your email for a verification link. Allow a minute before requesting another.' }
}
