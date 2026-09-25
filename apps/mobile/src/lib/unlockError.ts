/**
 * An unlock failure whose message is written for the person at the lock
 * screen. Other errors (native keychain/keystore failures, cancellations) are
 * shown as a generic retry message instead of their raw text.
 */
export class BiometricUnlockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BiometricUnlockError'
  }
}
