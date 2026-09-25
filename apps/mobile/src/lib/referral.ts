import { normalizeReferralCode, validateReferralCode } from '@ubuntu-fund/types'

/**
 * The referral code to send with a sign-up, or undefined. An optional code
 * must never block registration: one the API would reject (too short or
 * long, bad characters, reserved) is left out and the hint under the field
 * says so.
 */
/**
 * Share-sheet text for an affiliate's referral link. Tapping the https link
 * opens the Ujimora website, not the app (verified app links are not set up
 * yet), so the code is spelled out for people who sign up in the app, whose
 * sign-up form has a referral field.
 */
export function referralShareMessage(link: string, code: string): string {
  return `${link}\nSigning up in the Ujimora app? Enter referral code ${code}.`
}

export function signupReferralCode(raw: string | null | undefined): string | undefined {
  const code = normalizeReferralCode(raw ?? '')
  return code && validateReferralCode(code) === null ? code : undefined
}
