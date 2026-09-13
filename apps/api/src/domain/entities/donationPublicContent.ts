import { createHash } from 'node:crypto';
interface DonationPublicContent {
  campaignId: string;
  donorId: string;
  donorName?: string;
  message?: string;
  isAnonymous: boolean;
  messageHiddenAt?: Date;
  publicContentStatus?: 'pending' | 'approved' | 'rejected';
  publicContentFingerprint?: string;
  publicContentRevokedAt?: Date;
}
export function donationContentVersion(value: DonationPublicContent): string {
  return createHash('sha256').update(JSON.stringify([value.campaignId, value.donorId, value.donorName ?? '', value.message ?? '', value.isAnonymous, value.messageHiddenAt ?? null, value.publicContentRevokedAt ?? null])).digest('hex');
}
export function isDonationContentApproved(value: DonationPublicContent): boolean {
  return !value.publicContentRevokedAt && value.publicContentStatus === 'approved' && value.publicContentFingerprint === donationContentVersion(value);
}
