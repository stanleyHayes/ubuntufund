import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { PublicationAdmissionPort } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { UserBlockRepositoryPort } from '../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { CampaignStatus } from '@ubuntu-fund/types';
import type { CampaignComment, CreateCampaignCommentInput } from '@ubuntu-fund/types';
import type { CampaignCommentRepositoryPort, CampaignCommentRecord } from '../../domain/ports/outbound/CampaignCommentRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class CampaignCommentUseCases {
  constructor(
    private readonly comments: CampaignCommentRepositoryPort,
    private readonly campaigns: CampaignRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort,
    private readonly blocks?: UserBlockRepositoryPort,
    private readonly admission?: PublicationAdmissionPort
  ) {}

  private async toDTO(comment: CampaignCommentRecord): Promise<CampaignComment> {
    const author = await this.users.findById(comment.authorId);
    return {
      ...comment,
      authorName: author?.name ?? 'Former member',
      authorAvatarUrl: author?.avatarUrl,
    };
  }

  async list(campaignId: string, limit = 100, viewerId?: string, isAdmin = false): Promise<CampaignComment[]> {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (![CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(campaign.status) && campaign.creatorId !== viewerId && !isAdmin) throw new AppError('Campaign not found', 404);
    const comments = await this.comments.findByCampaignId(campaignId, Math.min(Math.max(limit, 1), 200));
    const excluded = await this.visibility.hiddenContentAuthorIds(comments.map(comment => comment.authorId), viewerId);
    return Promise.all(comments.filter(comment => !excluded.has(comment.authorId)).map((comment) => this.toDTO(comment)));
  }

  async create(campaignId: string, authorId: string, input: CreateCampaignCommentInput): Promise<CampaignComment> {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (![CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(campaign.status) && campaign.creatorId !== authorId) throw new AppError('Campaign not found', 404);
    if (campaign && this.blocks && await this.blocks.isBlocked(authorId, campaign.creatorId)) throw new AppError('You cannot comment on this campaign', 403);
    const content = input.content.trim();
    if (!content) throw new AppError('Comment cannot be empty', 400);
    if (!this.admission) throw new AppError('Publication review is unavailable', 503);
    await this.admission.assertAllowed({ actorId: authorId, action: 'comment.create', resourceId: campaignId, text: content, mediaUrls: [], automatedReviewConsent: input.automatedReviewConsent });
    const comment = await this.comments.create(campaignId, authorId, content);
    return this.toDTO(comment);
  }

  async remove(campaignId: string, commentId: string, actorId: string, isAdmin: boolean): Promise<void> {
    const [campaign, comment] = await Promise.all([this.campaigns.findById(campaignId), this.comments.findById(commentId)]);
    if (!campaign || !comment || comment.campaignId !== campaignId) throw new AppError('Comment not found', 404);
    if (!isAdmin && comment.authorId !== actorId && campaign.creatorId !== actorId) {
      throw new AppError('You cannot delete this comment', 403);
    }
    await this.comments.softDelete(commentId);
  }
}
