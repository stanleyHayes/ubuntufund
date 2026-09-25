/**
 * User-facing copy for auth failures. Kept free of React Native imports so the
 * mapping can be unit-tested; the API never says whether an account exists.
 */
export function forgotPasswordErrorMessage(err: unknown): string {
  const status = (err as { status?: unknown } | null)?.status
  if (status === 429) return 'Too many attempts. Please wait about 15 minutes and try again.'
  if (status === 400) return 'Enter a valid email address.'
  // fetch() rejects with a TypeError ("Network request failed") when offline.
  if (status === 0 || err instanceof TypeError) return "Can't reach Ujimora. Check your connection and try again."
  return 'Password recovery is temporarily unavailable. Please try again later.'
}
