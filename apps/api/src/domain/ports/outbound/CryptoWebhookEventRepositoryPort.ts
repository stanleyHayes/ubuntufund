/**
 * Idempotency store for crypto provider webhooks (Crypto Donations plan §8).
 */
export interface CryptoWebhookEventRepositoryPort {
  /**
   * Record a webhook event once. Returns true when it was newly recorded (the
   * caller should process it), or false when (provider, eventId) was already
   * seen (a duplicate/replay — the caller must skip it). Atomic via the unique
   * (provider, eventId) index.
   */
  recordIfNew(provider: string, eventId: string, type: string): Promise<boolean>;
}
