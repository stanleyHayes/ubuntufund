import type { BeneficiaryPayout, BeneficiaryRecipient } from '@ubuntu-fund/types';
import type { BeneficiaryPayoutEntity } from '../../../domain/entities/BeneficiaryPayout.js';

export function toBeneficiaryPayoutDto(
  entity: BeneficiaryPayoutEntity
): BeneficiaryPayout {
  const p = entity.toPlain();
  return {
    id: p.id,
    campaignId: p.campaignId,
    beneficiaryId: p.beneficiaryId,
    recipientId: p.recipientId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    providerRef: p.providerRef,
    transferCode: p.transferCode,
    requestedBy: p.requestedBy,
    approvedBy: p.approvedBy,
    firstApprovedBy: p.firstApprovedBy,
    firstApprovedAt: p.firstApprovedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** The recipient DTO is already a plain shape; re-exported for symmetry. */
export function toBeneficiaryRecipientDto(
  recipient: BeneficiaryRecipient
): BeneficiaryRecipient {
  return recipient;
}
