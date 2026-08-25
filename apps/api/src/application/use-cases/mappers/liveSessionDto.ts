import type {
  LiveSession,
  LiveSessionPublicView,
} from '@ubuntu-fund/types';
import type { LiveSessionEntity } from '../../../domain/entities/LiveSession.js';

/**
 * Full owner-facing DTO — includes the secret `overlayToken`. Only ever
 * returned to the campaign owner (start / update / rotate responses).
 */
export function toLiveSessionDto(entity: LiveSessionEntity): LiveSession {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    campaignId: plain.campaignId,
    title: plain.title,
    targetAmount: plain.targetAmount,
    status: plain.status,
    overlayToken: plain.overlayToken,
    showDonorNames: plain.showDonorNames,
    showDonorMessages: plain.showDonorMessages,
    showAmounts: plain.showAmounts,
    privacyMode: plain.privacyMode,
    startedAt: plain.startedAt,
    endedAt: plain.endedAt,
    stats: { ...plain.stats },
  };
}

/**
 * Public donor sheet — omits the overlay token and nulls the raised amount
 * when the host has hidden amounts.
 */
export function toLiveSessionPublicView(
  entity: LiveSessionEntity
): LiveSessionPublicView {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    campaignId: plain.campaignId,
    title: plain.title,
    targetAmount: plain.targetAmount,
    status: plain.status,
    startedAt: plain.startedAt,
    endedAt: plain.endedAt,
    amountRaised: entity.amountsVisible() ? plain.stats.amountRaised : null,
    successfulDonations: plain.stats.successfulDonations,
  };
}
