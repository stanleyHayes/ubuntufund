export interface BillingOwnershipPort {
  /**
   * Durable, exclusive billing rail claim made before opening a payment sheet.
   * A user-initiated claim also restarts the short hold that protects a payment
   * still in flight. `refreshHold: 'on-switch'` (a member verifying a store
   * purchase) starts the hold only when the claim moves to this rail;
   * server-side re-verification passes `refreshHold: false` and never starts it.
   */
  claimProvider(
    userId: string,
    provider: 'web' | 'apple' | 'google',
    options?: { refreshHold?: boolean | 'on-switch' }
  ): Promise<void>;
}
