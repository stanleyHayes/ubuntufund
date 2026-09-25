export interface BillingOwnershipPort {
  /**
   * Durable, exclusive billing rail claim made before opening a payment sheet.
   * A user-initiated claim also restarts the short hold that protects a payment
   * still in flight; server-side re-verification passes `refreshHold: false`.
   */
  claimProvider(userId: string, provider: 'web' | 'apple' | 'google', options?: { refreshHold?: boolean }): Promise<void>;
}
