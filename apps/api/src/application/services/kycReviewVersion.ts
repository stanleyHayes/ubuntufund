import { createHash } from 'node:crypto';
import type { KYCVerificationRecord } from '../../domain/ports/outbound/KYCRepositoryPort.js';

/** Bind a staff decision to the complete persisted application returned for review. */
export function kycReviewVersion(record: KYCVerificationRecord): string {
  return createHash('sha256').update(JSON.stringify(record)).digest('hex');
}
