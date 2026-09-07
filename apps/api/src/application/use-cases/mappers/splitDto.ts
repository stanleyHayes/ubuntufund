import type {
  BeneficiaryStatement,
  BeneficiaryStatementEntry,
  CampaignBeneficiaryAccrual,
  CampaignBeneficiaryBalance,
  CampaignSplitVersion,
  CampaignSplitDisclosure,
} from '@ubuntu-fund/types';
import type { CampaignSplitVersionEntity } from '../../../domain/entities/CampaignSplitVersion.js';

/** Full split version (owner/admin view — includes consent + beneficiary email). */
export function toSplitDto(
  entity: CampaignSplitVersionEntity
): CampaignSplitVersion {
  const p = entity.toPlain();
  return {
    id: p.id,
    campaignId: p.campaignId,
    version: p.version,
    status: p.status,
    allocations: p.allocations,
    locked: p.locked,
    lockedAt: p.lockedAt,
    createdBy: p.createdBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Donor-facing disclosure — names + shares + consent only, no contact detail. */
export function toSplitDisclosure(
  entity: CampaignSplitVersionEntity
): CampaignSplitDisclosure {
  const p = entity.toPlain();
  return {
    campaignId: p.campaignId,
    version: p.version,
    locked: p.locked,
    beneficiaries: p.allocations.map((a) => ({
      name: a.name,
      shareBps: a.shareBps,
      sharePercent: a.shareBps / 100,
      consent: a.consent,
    })),
  };
}

/**
 * A beneficiary's statement: their balance plus one accrual line per settled
 * donation that credited them, and a refund line for any that were reversed.
 */
export function toBeneficiaryStatement(
  campaignId: string,
  beneficiaryId: string,
  balance: CampaignBeneficiaryBalance,
  accruals: CampaignBeneficiaryAccrual[]
): BeneficiaryStatement {
  const entries: BeneficiaryStatementEntry[] = [];
  for (const accrual of accruals) {
    const entry = accrual.entries.find((e) => e.beneficiaryId === beneficiaryId);
    if (!entry) continue;
    entries.push({
      at: accrual.createdAt,
      kind: 'accrual',
      amount: entry.amount,
      currency: accrual.currency,
      donationIntentId: accrual.donationIntentId,
      splitVersion: accrual.splitVersion,
    });
    if (accrual.reversed) {
      entries.push({
        at: accrual.createdAt,
        kind: 'refund',
        amount: entry.amount,
        currency: accrual.currency,
        donationIntentId: accrual.donationIntentId,
        splitVersion: accrual.splitVersion,
      });
    }
  }
  return { campaignId, beneficiaryId, currency: balance.currency, balance, entries };
}
