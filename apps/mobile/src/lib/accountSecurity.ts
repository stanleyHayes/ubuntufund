import { api, type AuthTokens } from './api'

export type PasswordChangeResult = 'saved' | 'session-not-saved'

/**
 * The API rotates authVersion on a password change, so this device's old tokens
 * stop working at once. Store the fresh pair it returns (via the AuthContext's
 * replaceTokens, which also re-seals the biometric vault) to stay signed in.
 */
export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  userId: string | undefined,
  replaceTokens: (tokens: AuthTokens, userId: string) => Promise<void>,
): Promise<PasswordChangeResult> {
  const result = await api.put<{ tokens?: AuthTokens }>('/auth/change-password', input)
  if (!result?.tokens || !userId) return 'session-not-saved'
  try {
    await replaceTokens(result.tokens, userId)
    return 'saved'
  } catch {
    return 'session-not-saved'
  }
}
