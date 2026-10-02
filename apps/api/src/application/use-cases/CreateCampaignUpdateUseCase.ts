import type { CampaignContentWritePort } from '../../domain/ports/outbound/CampaignContentWritePort.js';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { CampaignUpdate, CreateCampaignUpdateInput } from '@ubuntu-fund/types';
import { CampaignUpdateEntity } from '../../domain/entities/CampaignUpdate.js';
import type { CampaignUpdateRepositoryPort } from '../../domain/ports/outbound/CampaignUpdateRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { PublicationAlreadyPublished } from '../../infrastructure/adapters/inbound/middleware/publicationErrors.js';
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

export class CreateCampaignUpdateUseCase {
  constructor(
    private readonly updateRepo: CampaignUpdateRepositoryPort,
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly admission?: PublicationAdmissionPort,
    private readonly publication?: CampaignContentWritePort
  ) {}

  async execute(
    campaignId: string,
    input: CreateCampaignUpdateInput,
    authorId: string,
    authVersion = ''
  ): Promise<CampaignUpdate> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    if (campaign.creatorId !== authorId) {
      throw new AppError('Only the campaign creator can post updates', 403);
    }

    if (!input.title || !input.content) {
      throw new AppError('Title and content are required', 400);
    }

    if (!this.admission) throw new AppError('Publication review is unavailable', 503);
    const submission: PublicationSubmission = { actorId: authorId, action: 'update.create', resourceId: campaignId, text: JSON.stringify([input.title, input.content, input.type]), mediaUrls: input.mediaUrls ?? [], automatedReviewConsent: input.automatedReviewConsent,
      authVersion, applyOptions: { isPinned: input.isPinned ?? false } };
    try {
      await this.admission.assertAllowed(submission);
      const now = new Date();
      const update = new CampaignUpdateEntity({
        id: '', // Will be assigned by the repository
        campaignId,
        authorId,
        title: input.title,
        content: input.content,
        type: input.type,
        mediaUrls: input.mediaUrls ?? [],
        isPinned: input.isPinned ?? false,
        createdAt: now,
        updatedAt: now,
      });

      if (!this.publication || !this.admission.assertCurrent) throw new AppError('Update publication verification is unavailable', 503);
      return await this.publication.run(authorId, authVersion, campaignId, campaign.creatorId, async () => {
        const saved = await this.updateRepo.save(update, { publicationFingerprint: publicationFingerprint(submission) });
        // Consumes the approval with what it published; a version already published (by its approval, say) rolls this back.
        await this.admission!.assertCurrent!(submission, { publishedResourceId: saved.id });
        return toDTO(saved);
      });
    } catch (error) {
      if (error instanceof PublicationAlreadyPublished) return this.alreadyPosted(error.resourceId, campaignId, authorId);
      throw error;
    }
  }

  /**
   * The identical update again, after it was published (by its approval, or
   * by an earlier request): the same post, so a client repeating the request
   * gets the existing update. Once that update was deleted, posting the
   * identical update again is refused.
   */
  private async alreadyPosted(updateId: string | undefined, campaignId: string, authorId: string): Promise<CampaignUpdate> {
    const existing = updateId ? await this.updateRepo.findById(updateId) : null;
    if (existing?.campaignId === campaignId && existing.authorId === authorId) return toDTO(existing);
    throw new AppError('You already posted this exact update; change it to post again.', 409);
  }
}
