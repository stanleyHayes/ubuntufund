/**
 * The payment provider has no transaction under this reference (e.g. the
 * checkout was never registered, or it belongs to another key/mode). Distinct
 * from a transient provider error so reconciliation can close a stale intent
 * instead of re-verifying it forever.
 */
export class ProviderTransactionNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(readonly reference: string) {
    super('Payment reference not found at the provider');
    this.name = 'ProviderTransactionNotFoundError';
  }
}
