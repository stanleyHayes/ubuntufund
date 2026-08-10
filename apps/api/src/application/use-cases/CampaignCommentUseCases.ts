import type { CampaignComment, CreateCampaignCommentInput } from '@ubuntu-fund/types';
import type { CampaignCommentRepositoryPort, CampaignCommentRecord } from '../../domain/ports/outbound/CampaignCommentRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class CampaignCommentUseCases {
  constructor(
    private readonly comments: CampaignCommentRepositoryPort,
    private readonly campaigns: CampaignRepositoryPort,
    private readonly users: UserRepositoryPort
  ) {}

  private async toDTO(comment: CampaignCommentRecord): Promise<CampaignComment> {
    const author = await this.users.findById(comment.authorId);
    return {
      ...comment,
      authorName: author?.name ?? 'Former member',
      authorAvatarUrl: author?.avatarUrl,
    };
  }

  async list(campaignId: string, limit = 100): Promise<CampaignComment[]> {
    if (!(await this.campaigns.findById(campaignId))) throw new AppError('Campaign not found', 404);
    const comments = await this.comments.findByCampaignId(campaignId, Math.min(Math.max(limit, 1), 200));
    return Promise.all(comments.map((comment) => this.toDTO(comment)));
  }

  async create(campaignId: string, authorId: string, input: CreateCampaignCommentInput): Promise<CampaignComment> {
    if (!(await this.campaigns.findById(campaignId))) throw new AppError('Campaign not found', 404);
    const content = input.content.trim();
    if (!content) throw new AppError('Comment cannot be empty', 400);
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
