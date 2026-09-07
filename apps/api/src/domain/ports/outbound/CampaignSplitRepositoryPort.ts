import type { CampaignSplitVersionEntity } from '../../entities/CampaignSplitVersion.js';
import type { BeneficiaryConsentStatus } from '@ubuntu-fund/types';

export interface CampaignSplitRepositoryPort {
  create(split: CampaignSplitVersionEntity): Promise<CampaignSplitVersionEntity>;
  /** The single active split governing accruals, if any. */
  findActive(campaignId: string): Promise<CampaignSplitVersionEntity | null>;
  findByCampaignAndVersion(
    campaignId: string,
    version: number
  ): Promise<CampaignSplitVersionEntity | null>;
  /** Every version for a campaign, newest first (owner/admin history). */
  findAllByCampaign(campaignId: string): Promise<CampaignSplitVersionEntity[]>;
  /** The next monotonic version number for a campaign (max + 1, or 1). */
  nextVersion(campaignId: string): Promise<number>;

  /**
   * Set one beneficiary's consent on a version. Refused (null) when the version
   * is locked or the beneficiary is not on it — consent is a pre-lock action.
   */
  setConsent(
    campaignId: string,
    version: number,
    beneficiaryId: string,
    status: BeneficiaryConsentStatus
  ): Promise<CampaignSplitVersionEntity | null>;

  /**
   * Make `version` the active split, superseding any other active version.
   * Returns the now-active version, or null when the target no longer exists in
   * a promotable (draft/active) state.
   */
  activate(
    campaignId: string,
    version: number
  ): Promise<CampaignSplitVersionEntity | null>;

  /**
   * Lock the active version the first time a contribution accrues against it
   * (spec §17 / ADR-3). Idempotent: null when there is no unlocked active split.
   */
  lockActive(campaignId: string): Promise<CampaignSplitVersionEntity | null>;
}
