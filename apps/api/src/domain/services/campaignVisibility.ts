import { CampaignStatus } from '@ubuntu-fund/types';

/** These states are intended for public discovery, detail and share previews. */
export const PUBLIC_CAMPAIGN_STATUSES: CampaignStatus[] = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED];
export function isPublicCampaign(status: CampaignStatus): boolean {
  return PUBLIC_CAMPAIGN_STATUSES.includes(status);
}
