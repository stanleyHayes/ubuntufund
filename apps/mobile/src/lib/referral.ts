import { normalizeReferralCode, validateReferralCode } from '@ubuntu-fund/types'

/**
 * The referral code to send with a sign-up, or undefined. An optional code
 * must never block registration: one the API would reject (too short or
 * long, bad characters, reserved) is left out and the hint under the field
 * says so.
 */
export function signupReferralCode(raw: string | null | undefined): string | undefined {
  const code = normalizeReferralCode(raw ?? '')
  return code && validateReferralCode(code) === null ? code : undefined
}
