/**
 * Which Paystack environment created a recipient code. A code created with a
 * test key does not exist for the live key (and vice versa), so a transfer to
 * it is refused after a test → live cutover.
 */
export type PaystackMode = 'live' | 'test'

export function paystackModeFromSecret(secretKey: string): PaystackMode {
  return secretKey.startsWith('sk_live_') ? 'live' : 'test'
}

/**
 * A stored recipient code is stale only when it is TAGGED with the other mode.
 * Untagged (pre-tagging) codes are left alone here: the tag-recipient-mode
 * script establishes their mode against Paystack before anything relies on it.
 */
export function isRecipientFromOtherMode(stored: PaystackMode | undefined, current: PaystackMode | undefined): boolean {
  return Boolean(stored && current && stored !== current)
}
