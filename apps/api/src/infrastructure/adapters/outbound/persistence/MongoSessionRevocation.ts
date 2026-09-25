import type { SessionRevocationPort } from '../../../../domain/ports/outbound/SessionRevocationPort.js';
import { RevokedSessionModel } from '../../../database/models/RevokedSessionModel.js';

/** Longest refresh-token lifetime (7d) plus a day of clock margin. */
const RETENTION_MS = 8 * 24 * 60 * 60 * 1000;

export class MongoSessionRevocation implements SessionRevocationPort {
  async revoke(sessionId: string, userId: string): Promise<void> {
    const now = new Date();
    // Idempotent: repeated sign-outs keep the first revocation time.
    await RevokedSessionModel.updateOne({ sessionId }, { $setOnInsert: { sessionId, userId, revokedAt: now, expiresAt: new Date(now.getTime() + RETENTION_MS) } }, { upsert: true });
  }

  async isRevoked(sessionId: string): Promise<boolean> {
    return !!(await RevokedSessionModel.exists({ sessionId }));
  }
}
