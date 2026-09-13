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
}
