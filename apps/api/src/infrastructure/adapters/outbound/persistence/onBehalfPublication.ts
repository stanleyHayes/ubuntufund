import { CampaignStatus, isContentCheckOutstanding, type OnBehalfNextStep } from '@ubuntu-fund/types';
import { CampaignReviewModel } from '../../../database/models/CampaignReviewModel.js';
import { CampaignBeneficiaryConsentEventModel } from '../../../database/models/CampaignBeneficiaryConsentEventModel.js';
import { CampaignBeneficiaryInvitationModel } from '../../../database/models/CampaignBeneficiaryInvitationModel.js';
import type { CampaignDocument } from '../../../database/models/CampaignModel.js';

type PublicationRules = Pick<CampaignDocument, 'status' | 'endDate' | 'contentReviewReason' | 'contentReviewClearedAt'> & {
  _id: unknown;
  onBehalf?: Pick<NonNullable<CampaignDocument['onBehalf']>, 'consentStatus' | 'publicationRequiresConsent' | 'staffReviewRequired' | 'autoPublishOnConsent'>;
};

type BeneficiaryWait = Pick<PublicationRules, '_id' | 'contentReviewReason' | 'contentReviewClearedAt'> & {
  onBehalf?: Pick<NonNullable<PublicationRules['onBehalf']>, 'consentStatus'>;
};

/**
 * Whether the beneficiary's acceptance alone publishes the campaign: consent
 * was its only hold (tiering would have published it, no on-behalf staff
 * review), and nothing since asked for a person.
 *
 * Two rules also cover campaigns from before they were recorded on the
 * campaign itself, by reading history instead of rewriting it:
 * - after a rejection or block in the campaign review, only a new staff
 *   approval publishes it (blocks now also switch the flag off);
 * - a beneficiary change recorded before changes were admitted like new
 *   content (no `admission` on its consent event) was never checked, so staff
 *   approve after the acceptance.
 */
export async function consentPublishes(campaign: PublicationRules): Promise<boolean> {
  const onBehalf = campaign.onBehalf;
  if (!onBehalf?.publicationRequiresConsent || !onBehalf.autoPublishOnConsent || onBehalf.staffReviewRequired) return false;
  const campaignId = String(campaign._id);
  if (await CampaignReviewModel.exists({ campaignId, action: { $in: ['reject', 'block'] } })) return false;
  const lastChange = await CampaignBeneficiaryConsentEventModel.findOne({ campaignId, event: 'beneficiary_changed' })
    .sort({ createdAt: -1, _id: -1 }).select('admission').lean();
  return !lastChange || !!lastChange.admission;
}

/**
 * The content check of a campaign run for someone waits, but nobody is left
 * to invite once staff clear it: the held invitation was withdrawn when staff
 * rejected or blocked the content (see `dropHeldInvitations`), and the
 * campaign has since returned to review. Approval refuses it until the
 * organizer names the beneficiary again (or staff reassign it), which holds a
 * new invitation for the same check.
 */
export async function awaitsBeneficiary(campaign: BeneficiaryWait): Promise<boolean> {
  if (!campaign.onBehalf || campaign.onBehalf.consentStatus !== 'pending' || !isContentCheckOutstanding(campaign)) return false;
  return !(await CampaignBeneficiaryInvitationModel.exists({ campaignId: String(campaign._id), status: 'held' }));
}

/**
 * What makes a pending campaign go live from here, for the people running it
 * (see `OnBehalfNextStep`). Undefined when it is not waiting for review, or
 * cannot go live for this beneficiary (declined, withdrawn, ended).
 */
export async function nextStepOf(campaign: PublicationRules, now = new Date()): Promise<OnBehalfNextStep | undefined> {
  const onBehalf = campaign.onBehalf;
  if (!onBehalf || campaign.status !== CampaignStatus.PENDING_REVIEW || campaign.endDate <= now) return undefined;
  if (isContentCheckOutstanding(campaign)) return (await awaitsBeneficiary(campaign)) ? 'name_beneficiary' : 'content_check';
  if (onBehalf.publicationRequiresConsent && onBehalf.consentStatus !== 'accepted') {
    if (onBehalf.consentStatus === 'declined' || onBehalf.consentStatus === 'revoked') return undefined;
    return (await consentPublishes(campaign)) ? 'consent' : 'staff_after_consent';
  }
  return 'staff';
}

/**
 * Staff are the next to act on a campaign in review that can still go live
 * (review refuses an ended one): its content waits for them, with a
 * beneficiary to invite once they clear it on a campaign run for someone, or
 * consent no longer does.
 */
export async function staffAreNext(campaign: PublicationRules, now = new Date()): Promise<boolean> {
  if (campaign.status !== CampaignStatus.PENDING_REVIEW || campaign.endDate <= now) return false;
  if (isContentCheckOutstanding(campaign)) return !(await awaitsBeneficiary(campaign));
  return !campaign.onBehalf?.publicationRequiresConsent || campaign.onBehalf.consentStatus === 'accepted';
}
