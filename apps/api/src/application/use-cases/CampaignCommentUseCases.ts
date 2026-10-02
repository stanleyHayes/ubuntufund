import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { CommentCreationPort } from '../../domain/ports/outbound/CommentCreationPort.js';
import type { UserBlockRepositoryPort } from '../../domain/ports/outbound/UserBlockRepositoryPort.js';
import { CampaignStatus } from '@ubuntu-fund/types';
import type { CampaignComment, CreateCampaignCommentInput } from '@ubuntu-fund/types';
import type { CampaignCommentRepositoryPort, CampaignCommentRecord } from '../../domain/ports/outbound/CampaignCommentRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { PublicationAlreadyPublished } from '../../infrastructure/adapters/inbound/middleware/publicationErrors.js';
import { publicationFingerprint } from '../../domain/services/publicationFingerprint.js';

export class CampaignCommentUseCases {
  constructor(
    private readonly comments: CampaignCommentRepositoryPort,
    private readonly campaigns: CampaignRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly visibility: PublicProfileVisibilityPort,
    private readonly blocks?: UserBlockRepositoryPort,
    private readonly admission?: PublicationAdmissionPort,
    private readonly creation?: CommentCreationPort
  ) {}

  private async toDTO(comment: CampaignCommentRecord): Promise<CampaignComment> {
    return {
      ...comment,
      // Only the attribution admitted with this comment may be projected.
      // Legacy comments have no reviewed snapshot; do not borrow live identity.
      authorName: comment.authorName ?? 'Community member',
      authorAvatarUrl: comment.authorName ? comment.authorAvatarUrl : undefined,
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

  async create(campaignId: string, authorId: string, input: CreateCampaignCommentInput, authVersion = ''): Promise<CampaignComment> {
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (![CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED].includes(campaign.status) && campaign.creatorId !== authorId) throw new AppError('Campaign not found', 404);
    if (campaign && this.blocks && await this.blocks.isBlocked(authorId, campaign.creatorId)) throw new AppError('You cannot comment on this campaign', 403);
    const content = input.content.trim();
    if (!content) throw new AppError('Comment cannot be empty', 400);
    if (!this.admission) throw new AppError('Publication review is unavailable', 503);
    const author = await this.users.findById(authorId);
    if (!author) throw new AppError('The publishing account is unavailable', 401);
    // Attribution is public content too, including a name entered at signup.
    // An avatar that already passed staff media review on the profile is bound
    // into the screened text instead of holding every comment for staff again;
    // a legacy or unreviewed avatar is still inspected as media.
    const reviewedAvatar = author.hasReviewedAvatar;
    const submission: PublicationSubmission = { actorId: authorId, action: 'comment.create', resourceId: campaignId,
      text: JSON.stringify({ authorName: author.name, ...(reviewedAvatar ? { authorAvatarUrl: author.avatarUrl } : {}), comment: content }),
      mediaUrls: author.avatarUrl && !reviewedAvatar ? [author.avatarUrl] : [], automatedReviewConsent: input.automatedReviewConsent, authVersion };
    try {
      await this.admission.assertAllowed(submission);
      if (!this.creation || !this.admission.assertCurrent) throw new AppError('Comment publication verification is unavailable', 503);
      return await this.creation.run(authorId, authVersion, campaignId, campaign.creatorId, async () => {
        const currentAuthor = await this.users.findById(authorId);
        if (!currentAuthor || currentAuthor.name !== author.name || currentAuthor.avatarUrl !== author.avatarUrl) {
          throw new AppError('Your public identity changed during review. Refresh and submit again.', 409);
        }
        if (this.blocks && await this.blocks.isBlocked(authorId, campaign.creatorId)) throw new AppError('You cannot comment on this campaign', 403);
        const comment = await this.comments.create(campaignId, authorId, content, { authorName: author.name, authorAvatarUrl: author.avatarUrl, publicationFingerprint: publicationFingerprint(submission) });
        // Consumes the approval with what it published; a version already published (by its approval, say) rolls this back.
        await this.admission!.assertCurrent!(submission, { publishedResourceId: comment.id });
        return this.toDTO(comment);
      });
    } catch (error) {
      if (error instanceof PublicationAlreadyPublished) return this.alreadyPosted(error.resourceId, campaignId, authorId);
      throw error;
    }
  }

  /**
   * The identical comment again, after it was published (by its approval, or
   * by an earlier request): the same post, so a client repeating the request
   * gets the existing comment. Once that comment was deleted, posting the
   * identical text again is refused.
   */
  private async alreadyPosted(commentId: string | undefined, campaignId: string, authorId: string): Promise<CampaignComment> {
    const existing = commentId ? await this.comments.findById(commentId) : null;
    if (existing?.campaignId === campaignId && existing.authorId === authorId) return this.toDTO(existing);
    throw new AppError('You already posted this exact comment; change it to post again.', 409);
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
