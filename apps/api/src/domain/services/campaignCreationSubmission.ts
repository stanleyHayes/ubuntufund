import type { CampaignCategory, CampaignPriority, CreateCampaignInput, OnBehalfCampaignInput } from '@ubuntu-fund/types';
import type { PublicationSubmission } from '../ports/outbound/PublicationAdmissionPort.js';

type PublicBeneficiary = Pick<OnBehalfCampaignInput, 'beneficiaryName' | 'beneficiaryType' | 'relationship' | 'reason' | 'payoutArrangement'>;

/**
 * The public version of a campaign: what screening reads and what an
 * approval's or a decline's fingerprint binds. A stored campaign rebuilds the
 * same version from its own fields (the beneficiary's email is not one of
 * them, and it is never public).
 */
export type CampaignPublicVersion = Pick<CreateCampaignInput, 'title' | 'description' | 'category' | 'priority' | 'beneficiaries' | 'goalAmount' | 'currency' | 'imageUrls' | 'automatedReviewConsent'> & {
  endDate: Date | string;
  onBehalf?: PublicBeneficiary;
};

/**
 * The exact public version a new campaign is admitted as. Changing the text
 * (fields, their order or formatting) changes every fingerprint: approvals and
 * declines stored before the change would stop matching. A test pins it.
 */
export function campaignCreationSubmission(input: CampaignPublicVersion, creatorId: string, authVersion?: string): PublicationSubmission {
  const onBehalf = input.onBehalf;
  return {
    actorId: creatorId, action: 'campaign.create', resourceId: creatorId,
    text: JSON.stringify({ title: input.title, description: input.description,
      category: input.category, priority: input.priority, beneficiaries: input.beneficiaries,
      goalAmount: input.goalAmount, currency: input.currency, endDate: new Date(input.endDate).toISOString(),
      // Public on the campaign page; the beneficiary's email never is, so it is not screened.
      ...(onBehalf ? { onBehalf: { beneficiaryName: onBehalf.beneficiaryName, beneficiaryType: onBehalf.beneficiaryType,
        relationship: onBehalf.relationship, reason: onBehalf.reason, payoutArrangement: onBehalf.payoutArrangement } } : {}) }),
    mediaUrls: input.imageUrls ?? [], automatedReviewConsent: input.automatedReviewConsent,
    // The organizer's own request; never part of the version or its fingerprint.
    ...(authVersion !== undefined ? { authVersion } : {}),
  };
}

/** The fields of a stored campaign that make up its public version. */
export interface StoredCampaignFields {
  title: string;
  description: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  beneficiaries: readonly string[];
  goalAmount: number;
  currency: string;
  endDate: Date;
  imageUrls: readonly string[];
  /** Only on a campaign run on someone's behalf. */
  onBehalf?: PublicBeneficiary;
}

/**
 * A stored campaign's public version, as a new campaign would submit it: what
 * a decline in the campaign review binds, and, with a new beneficiary in
 * `onBehalf`, what a beneficiary change is admitted as.
 */
export function storedCampaignVersion(campaign: StoredCampaignFields): CampaignPublicVersion {
  const onBehalf = campaign.onBehalf;
  return {
    title: campaign.title, description: campaign.description, category: campaign.category, priority: campaign.priority,
    beneficiaries: [...campaign.beneficiaries], goalAmount: campaign.goalAmount, currency: campaign.currency,
    endDate: campaign.endDate, imageUrls: [...campaign.imageUrls],
    ...(onBehalf ? { onBehalf: { beneficiaryName: onBehalf.beneficiaryName, beneficiaryType: onBehalf.beneficiaryType,
      relationship: onBehalf.relationship, reason: onBehalf.reason, payoutArrangement: onBehalf.payoutArrangement } } : {}),
  };
}
