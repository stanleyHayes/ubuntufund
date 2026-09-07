import type {
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
