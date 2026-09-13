export interface BillingOwnershipPort {
  /** Durable, exclusive billing rail claim made before opening a payment sheet. */
  claimProvider(userId: string, provider: 'web' | 'apple' | 'google'): Promise<void>;
}
