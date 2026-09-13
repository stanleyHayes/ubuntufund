/** Commits current account authorization, reservation and payout reference together. */
export interface CreatorWithdrawalTransactionPort {
  run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T>;
}
