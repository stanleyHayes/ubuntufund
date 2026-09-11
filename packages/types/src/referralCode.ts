// Referral-code rules, shared by the API, the web app and the mobile app so all
// three agree on what a valid code looks like. The client validates to give
// immediate feedback; the API validates because a client check is not a control.

/** Minimum length of a custom referral code. */
export const REFERRAL_CODE_MIN = 3

/** Maximum length. Long enough for a brand or handle, short enough to say aloud. */
export const REFERRAL_CODE_MAX = 24

/**
 * Letters, digits and single inner hyphens. No leading/trailing hyphen and no
 * consecutive hyphens, so a code stays readable in a URL and over the phone.
 */
export const REFERRAL_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Codes nobody may claim.
 *
 * Two reasons: a code becomes a `?ref=` value and appears in marketing next to
 * the brand, so anything that reads as official could be used to impersonate
 * Ujimora; and a few are route-shaped, which would make shared links ambiguous
 * if referral codes ever move into the path.
 */
export const RESERVED_REFERRAL_CODES: readonly string[] = [
  'admin',
  'administrator',
  'api',
  'app',
  'auth',
  'billing',
  'campaign',
  'campaigns',
  'checkout',
  'contact',
  'dashboard',
  'donate',
  'explore',
  'help',
  'login',
  'logout',
  'me',
  'new',
  'official',
  'payout',
  'payouts',
  'pricing',
  'privacy',
  'register',
  'root',
  'security',
  'settings',
  'signin',
  'signup',
  'support',
  'system',
  'team',
  'terms',
  'ujimora',
  'ujimorahq',
  'ujimoraofficial',
  'www',
]

export type ReferralCodeProblem =
  | 'too-short'
  | 'too-long'
  | 'invalid-characters'
  | 'reserved'

/** Normalised form: codes resolve case-insensitively and are stored lowercase. */
export function normalizeReferralCode(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * Validate a *custom* referral code. Returns null when acceptable, else the
 * reason. Uniqueness is not checked here — only the API can do that.
 */
export function validateReferralCode(code: string): ReferralCodeProblem | null {
  const value = normalizeReferralCode(code)
  if (value.length < REFERRAL_CODE_MIN) return 'too-short'
  if (value.length > REFERRAL_CODE_MAX) return 'too-long'
  if (!REFERRAL_CODE_PATTERN.test(value)) return 'invalid-characters'
  if (RESERVED_REFERRAL_CODES.includes(value)) return 'reserved'
  return null
}

/** Human-readable message for a validation problem, shared across clients. */
export function referralCodeProblemMessage(problem: ReferralCodeProblem): string {
  switch (problem) {
    case 'too-short':
      return `Use at least ${REFERRAL_CODE_MIN} characters.`
    case 'too-long':
      return `Use at most ${REFERRAL_CODE_MAX} characters.`
    case 'invalid-characters':
      return 'Use letters and numbers, with single hyphens between them.'
    case 'reserved':
      return 'That code is reserved. Try another.'
  }
}
