import type { PaystackMode } from '../../value-objects/PaystackMode.js'
export interface SavedPayoutAccount {
  id: string
  fingerprint: string
  type: 'ghipss' | 'mobile_money'
  accountNumber: string
  bankCode: string
  accountName: string
  recipientCode: string
  verificationStatus: 'name_matched' | 'needs_review'
  resolvedAccountName?: string
  /** Paystack environment that created `recipientCode` (absent on older rows). */
  recipientMode?: PaystackMode
}
export interface PayoutAccountRepositoryPort {
  /** Conditional write inside the caller transaction, fencing removal/detail changes. */
  claimCurrent?(userId: string, account: SavedPayoutAccount): Promise<boolean>
  list(userId: string): Promise<SavedPayoutAccount[]>
  addWithinLimit(userId: string, account: SavedPayoutAccount, limit: number): Promise<boolean>
  remove(userId: string, id: string): Promise<void>
  /**
   * Re-record the typed name and provider name-check result of one saved
   * account, matched on its id and fingerprint. Null when it is gone.
   */
  /**
   * Replace one saved account's provider recipient (re-created for the
   * current Paystack mode), matched on id, fingerprint and the old code.
   */
  updateRecipient?(
    userId: string,
    id: string,
    fingerprint: string,
    previousCode: string,
    next: { recipientCode: string; recipientMode: PaystackMode },
  ): Promise<SavedPayoutAccount | null>
  updateVerification?(
    userId: string,
    id: string,
    fingerprint: string,
    patch: Pick<SavedPayoutAccount, 'accountName' | 'verificationStatus' | 'resolvedAccountName'>,
  ): Promise<SavedPayoutAccount | null>
}
