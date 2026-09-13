import { createHash } from 'node:crypto';

interface TipPublicContent {
  creatorUserId?: string;
  supporterUserId?: string;
  supporterName?: string;
  message?: string;
  isAnonymous?: boolean;
  messageHiddenAt?: Date;
  checkoutRevokedAt?: Date;
  publicContentStatus?: string;
  publicContentFingerprint?: string;
}
export function tipContentVersion(tip: TipPublicContent): string {
  return createHash('sha256').update(JSON.stringify([
    tip.creatorUserId ?? '', tip.supporterUserId ?? 'guest',
    tip.supporterName ?? '', tip.message ?? '', tip.isAnonymous ?? false,
    tip.messageHiddenAt ?? null, tip.checkoutRevokedAt ?? null,
  ])).digest('hex');
}
export function isTipContentApproved(tip: TipPublicContent): boolean {
  return tip.publicContentStatus === 'approved' && !tip.checkoutRevokedAt &&
    tip.publicContentFingerprint === tipContentVersion(tip);
}
