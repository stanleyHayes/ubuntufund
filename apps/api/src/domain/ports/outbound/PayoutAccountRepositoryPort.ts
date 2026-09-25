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
  updateVerification?(
    userId: string,
    id: string,
    fingerprint: string,
    patch: Pick<SavedPayoutAccount, 'accountName' | 'verificationStatus' | 'resolvedAccountName'>,
  ): Promise<SavedPayoutAccount | null>
}
