import type { CampaignOnBehalfSummary, CampaignViewerAccess } from '@ubuntu-fund/types';
import type { CampaignEntity } from '../../../domain/entities/Campaign.js';
import { payoutAuthorityOf } from '../../../domain/services/campaignPayoutAuthority.js';

/** The public part of an on-behalf campaign: who benefits, and whether they have confirmed. */
export function campaignOnBehalfSummary(campaign: CampaignEntity): CampaignOnBehalfSummary | undefined {
  const onBehalf = campaign.onBehalf;
  if (campaign.creationMode !== 'on_behalf' || !onBehalf) return undefined;
  return {
    beneficiaryName: onBehalf.beneficiaryName,
    beneficiaryType: onBehalf.beneficiaryType,
    beneficiaryConfirmed: onBehalf.consentStatus === 'accepted',
  };
}

/**
 * What the signed-in viewer may do. Informational for the UI only: every
 * endpoint re-checks on the server.
 */
export function campaignViewerAccess(campaign: CampaignEntity, viewerId: string | undefined, isManager: boolean): CampaignViewerAccess {
  const onBehalf = campaign.onBehalf;
  const beneficiary = !!viewerId && campaign.creationMode === 'on_behalf' && onBehalf?.beneficiaryUserId === viewerId && onBehalf.consentStatus === 'accepted';
  return {
    manage: isManager,
    beneficiary,
    payoutAuthority: !!viewerId && payoutAuthorityOf(campaign) === viewerId,
    thankDonors: isManager || beneficiary,
  };
}
