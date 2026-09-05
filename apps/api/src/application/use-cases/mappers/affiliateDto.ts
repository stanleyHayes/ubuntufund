import type { AffiliateCommission, AffiliatePayout } from '@ubuntu-fund/types';
import type { AffiliateCommissionEntity } from '../../../domain/entities/AffiliateCommission.js';
import type { AffiliatePayoutEntity } from '../../../domain/entities/AffiliatePayout.js';

export function toAffiliateCommissionDto(
  entity: AffiliateCommissionEntity
): AffiliateCommission {
  const p = entity.toPlain();
  return {
    id: p.id,
    affiliateId: p.affiliateId,
    refereeId: p.refereeId,
    source: p.source,
    sourceRef: p.sourceRef,
    amount: p.amount,
    currency: p.currency,
    baseAmount: p.baseAmount,
    commissionRate: p.commissionRate,
    status: p.status,
    maturesAt: p.maturesAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function toAffiliatePayoutDto(
  entity: AffiliatePayoutEntity
): AffiliatePayout {
  const p = entity.toPlain();
  return {
    id: p.id,
    affiliateId: p.affiliateId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    provider: p.provider,
    providerRef: p.providerRef,
    transferCode: p.transferCode,
    requestedBy: p.requestedBy,
    approvedBy: p.approvedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
