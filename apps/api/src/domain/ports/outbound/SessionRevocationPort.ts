/** Server-side sign-out: a revoked session id can no longer be refreshed. */
export interface SessionRevocationPort {
  revoke(sessionId: string, userId: string): Promise<void>;
  isRevoked(sessionId: string): Promise<boolean>;
}
