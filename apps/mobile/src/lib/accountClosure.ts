import { api } from './api'

/** GET /profile/closure-check: money that blocks closure and campaigns closure would end. */
export interface AccountClosureCheck {
  canClose: boolean
  message?: string
  openCampaigns: number
  blockers: { kind: string; currency?: string; amount?: number; count?: number }[]
}

/** Null when the preview is unavailable; the API still enforces every rule on delete. */
export async function loadAccountClosureCheck(): Promise<AccountClosureCheck | null> {
  try {
    const check = await api.get<AccountClosureCheck>('/profile/closure-check')
    return check && typeof check.canClose === 'boolean' ? check : null
  } catch {
    return null
  }
}

export async function loadMfaEnabled(): Promise<boolean> {
  try {
    return !!(await api.get<{ enabled?: boolean }>('/auth/mfa'))?.enabled
  } catch {
    return false
  }
}

export function openCampaignsWarning(check: AccountClosureCheck | null): string | null {
  const count = check?.openCampaigns ?? 0
  if (!count) return null
  return `Closing your account ends your ${count === 1 ? 'open campaign' : `${count} open campaigns`}. ${count === 1 ? 'It stops' : 'They stop'} accepting donations, and anything awaiting review is withdrawn.`
}

/** The API requires the current password, plus an authenticator or recovery code when MFA is on. */
export async function deleteAccount(password: string, code?: string): Promise<void> {
  const trimmed = code?.trim()
  await api.delete('/profile', { password, ...(trimmed ? { code: trimmed } : {}) })
}
