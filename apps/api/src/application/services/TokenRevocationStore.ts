export interface TokenRevocationStore {
  /** Invalidate every token for the user that was issued at or before `now`. */
  revokeAllForUser(userId: string): void;
  /** True when a token issued at `issuedAtMs` for the user is no longer valid. */
  isRevoked(userId: string, issuedAtMs: number): boolean;
}

/**
 * Per-process store of "tokens issued before T are dead" markers. Entries
 * self-expire once the longest-lived token (refresh, 7d) has aged out.
 * Swap for a Redis implementation when running multiple instances.
 */
export class InMemoryTokenRevocationStore implements TokenRevocationStore {
  private readonly revokedBefore = new Map<string, number>();

  constructor(private readonly maxTokenLifetimeMs: number = 7 * 24 * 60 * 60 * 1000) {
    const sweeper = setInterval(() => {
      const cutoff = Date.now() - this.maxTokenLifetimeMs;
      for (const [userId, at] of this.revokedBefore) {
        if (at < cutoff) this.revokedBefore.delete(userId);
      }
    }, 60 * 60 * 1000);
    sweeper.unref();
  }

  revokeAllForUser(userId: string): void {
    this.revokedBefore.set(userId, Date.now());
  }

  isRevoked(userId: string, issuedAtMs: number): boolean {
    const at = this.revokedBefore.get(userId);
    return at !== undefined && issuedAtMs <= at;
  }
}
