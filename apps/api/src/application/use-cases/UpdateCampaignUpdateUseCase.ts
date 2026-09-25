import type { CampaignContentWritePort } from '../../domain/ports/outbound/CampaignContentWritePort.js';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { CampaignUpdate, UpdateCampaignUpdateInput } from '@ubuntu-fund/types';
import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignUpdateEntity } from '../../domain/entities/CampaignUpdate.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { publicationFingerprint } from '../../domain/services/publicationFingerprint.js';

function toDTO(entity: CampaignUpdateEntity): CampaignUpdate {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    campaignId: plain.campaignId,
    authorId: plain.authorId,
    title: plain.title,
    content: plain.content,
    type: plain.type,
    mediaUrls: plain.mediaUrls,
    isPinned: plain.isPinned,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

export class UpdateCampaignUpdateUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly admission?: PublicationAdmissionPort,
    private readonly publication?: CampaignContentWritePort
  ) {}

  async execute(
    campaignId: string,
    updateId: string,
    input: UpdateCampaignUpdateInput,
    userId: string,
    authVersion = ''
  ): Promise<CampaignUpdate> {
    const update = await this.updateRepo.findById(updateId);
    if (!update || update.campaignId !== campaignId) {
      throw new AppError('Campaign update not found', 404);
    }

    // Team members post under their own authorId, so an owner-only check on
    // authorship left the organization unable to moderate its own campaign's
    // updates. The campaign owner can always act, as with comments.
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (update.authorId !== userId && campaign?.creatorId !== userId) {
      throw new AppError('You can only edit your own updates', 403);
    }

    const baseVersion = update.updatedAt.toISOString();
    update.applyEdits({
      title: input.title,
      content: input.content,
      type: input.type,
      mediaUrls: input.mediaUrls,
    });

    if (!this.admission) throw new AppError('Publication review is unavailable', 503);
    const submission: PublicationSubmission = { actorId: userId, action: 'update.edit', resourceId: updateId, baseVersion, text: JSON.stringify([update.title, update.content, update.type]), mediaUrls: update.mediaUrls, automatedReviewConsent: input.automatedReviewConsent };
    await this.admission.assertAllowed(submission);
    if (!this.publication || !this.admission.assertCurrent) throw new AppError('Update publication verification is unavailable', 503);
    return this.publication.run(userId, authVersion, campaignId, campaign.creatorId, async () => {
      await this.admission!.assertCurrent!(submission);
      return toDTO(await this.updateRepo.update(update, new Date(baseVersion), { publicationFingerprint: publicationFingerprint(submission) }));
    });
  }
}
