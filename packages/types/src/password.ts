// Password strength scoring, shared by the web and mobile signup forms.
//
// This lived twice — once in apps/web and once, byte for byte, in apps/mobile —
// so a rule change (say, raising the minimum length to match the backend) had
// to be made in two places and the two meters could silently disagree. Only the
// per-platform colour mapping stays in the components now.

export interface PasswordRule {
  label: string
  met: boolean
  /** The backend rejects the password outright when a required rule is unmet. */
  required?: boolean
}

/** Backend minimum is 8 characters; the rest are strength boosters. */
export function passwordRules(pw: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8, required: true },
    { label: 'An uppercase letter (A–Z)', met: /[A-Z]/.test(pw) },
    { label: 'A lowercase letter (a–z)', met: /[a-z]/.test(pw) },
    { label: 'A number (0–9)', met: /\d/.test(pw) },
    { label: 'A symbol (!?@#…)', met: /[^A-Za-z0-9]/.test(pw) },
  ]
}

/** Strength tiers, indexed by `passwordScore` - 1. */
export const PASSWORD_LEVELS = ['Weak', 'Fair', 'Good', 'Strong'] as const

export type PasswordLevel = (typeof PASSWORD_LEVELS)[number]

/**
 * Number of filled meter segments, 1–4. Takes the already-computed rules so a
 * caller that also renders the checklist does not evaluate the regexes twice.
 */
export function passwordScore(pw: string, rules: PasswordRule[] = passwordRules(pw)): number {
  if (!pw) return 0
  let score = rules.filter(rule => rule.met).length // 0–5
  if (pw.length >= 12 && score >= 3) score = Math.min(5, score + 1) // length bonus
  return Math.max(1, Math.min(4, score - 1))
}

/** Label for a score of 1–4. A score of 0 means the field is empty. */
export function passwordLevel(score: number): PasswordLevel {
  return PASSWORD_LEVELS[Math.min(PASSWORD_LEVELS.length, Math.max(1, score)) - 1]
}
