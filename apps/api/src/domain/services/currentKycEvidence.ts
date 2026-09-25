import type { KYCVerification } from '@ubuntu-fund/types';

/** The fields every current-verification decision reads. */
export type KycEvidence = Pick<KYCVerification, 'id' | 'verificationType' | 'status' | 'expiryDate' | 'createdAt'>;

/** Days before expiry from which an approved applicant may submit a renewal. */
export const KYC_RENEWAL_WINDOW_DAYS = 30;

/**
 * The newest record of each verification type. A newer submission supersedes
 * every older decision of the same type: a pending, in-review, rejected or
 * expired renewal suspends an older approval rather than riding on it.
 */
export function latestKycByType<T extends KycEvidence>(records: T[]): Map<string, T> {
  const latest = new Map<string, T>();
  const ordered = [...records].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || String(b.id).localeCompare(String(a.id)),
  );
  for (const record of ordered) {
    if (!latest.has(record.verificationType)) latest.set(record.verificationType, record);
  }
  return latest;
}

/**
 * An approval only counts while it carries a finite expiry still in the future.
 * Approvals without an expiry (legacy or hand-inserted rows) are not current:
 * status, level, campaign allowance and money-out checks must all agree on this.
 */
export function isCurrentApproval(record: Pick<KycEvidence, 'status' | 'expiryDate'> | null | undefined, now = new Date()): boolean {
  const expiry = record?.expiryDate ? new Date(record.expiryDate).getTime() : NaN;
  return record?.status === 'approved' && Number.isFinite(expiry) && expiry > now.getTime();
}

/** Whether the newest record of `type` is a current approval. */
export function hasCurrentKyc(records: KycEvidence[], type: string, now = new Date()): boolean {
  return isCurrentApproval(latestKycByType(records).get(type), now);
}

/**
 * A newer submission suspends an older approval (see {@link latestKycByType}),
 * so an early "update" would silently downgrade a verified account while it
 * waits for review. Returns the date renewal opens when a current approval of
 * `type` is still outside its renewal window, or null when submitting is fine.
 */
export function kycRenewalOpensAt(records: KycEvidence[], type: string, now = new Date()): Date | null {
  const latest = latestKycByType(records).get(type);
  if (!latest || !isCurrentApproval(latest, now)) return null;
  const opensAt = new Date(new Date(latest.expiryDate!).getTime() - KYC_RENEWAL_WINDOW_DAYS * 86_400_000);
  return opensAt.getTime() > now.getTime() ? opensAt : null;
}
