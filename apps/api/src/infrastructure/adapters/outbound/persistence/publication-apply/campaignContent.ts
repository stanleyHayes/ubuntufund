import { CampaignStatus, type CampaignUpdateType, type PublicationOutcomeReason } from '@ubuntu-fund/types';
import type { PublicationApplyReview } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { publicationFingerprint } from '../../../../../domain/services/publicationFingerprint.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';

/**
 * What the campaign content handlers (comment.create, update.create,
 * update.edit) share: reading the stored proposal, and the fingerprint the
 * published comment or update keeps.
 */

/** Ends the attempt as not published, with the reason the author is told. */
export const notPublished = (reason: PublicationOutcomeReason) => new PublicationApplyRefusal('not_published', reason);

/**
 * The exact-version fingerprint of the approved version, as its review record
 * holds it. What it publishes keeps it, as the author's own request does, so
 * moderation that removes the content also revokes the approval.
 */
export function approvedFingerprint(review: PublicationApplyReview): string {
  return publicationFingerprint({
    actorId: review.actorId, action: review.action, resourceId: review.resourceId, baseVersion: review.baseVersion,
    text: review.text, mediaUrls: review.mediaUrls,
  });
}

/** Statuses in which anyone may comment on a campaign; its owner may in any status (CampaignCommentUseCases). */
export const COMMENTABLE_STATUSES: readonly string[] = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED, CampaignStatus.EXPIRED];

/** The comment model's limit (CampaignCommentModel). */
const COMMENT_MAX_LENGTH = 1000;

/** comment.create's stored text: the attribution and the comment, exactly as reviewed. */
export interface CommentProposal {
  authorName: string;
  /** Present when the avatar had already passed media review; otherwise the avatar is the reviewed media. */
  authorAvatarUrl?: string;
  comment: string;
}

const parseJson = (text: string): unknown => {
  try { return JSON.parse(text); } catch { return undefined; }
};

/** Null when the stored text is not a comment proposal (for example, plain text from before 13 Sept). */
export function parseCommentProposal(review: PublicationApplyReview): CommentProposal | null {
  const value = parseJson(review.text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { authorName, authorAvatarUrl, comment } = value as Record<string, unknown>;
  if (typeof authorName !== 'string' || typeof comment !== 'string' || !comment.trim() || comment.length > COMMENT_MAX_LENGTH) return null;
  if (authorAvatarUrl !== undefined && (typeof authorAvatarUrl !== 'string' || !authorAvatarUrl)) return null;
  if (review.mediaUrls.length > 1) return null;
  return { authorName, comment, ...(authorAvatarUrl === undefined ? {} : { authorAvatarUrl }) };
}

/**
 * The avatar a comment is published with: the reviewed one in the text, or
 * the one reviewed as its media, or none ('').
 */
export const commentAvatarOf = (review: PublicationApplyReview, proposal: CommentProposal): string =>
  proposal.authorAvatarUrl ?? review.mediaUrls[0] ?? '';

const UPDATE_TYPES: readonly string[] = ['milestone', 'general', 'thank_you', 'urgent'] satisfies CampaignUpdateType[];
const isUpdateType = (value: unknown): value is CampaignUpdateType => typeof value === 'string' && UPDATE_TYPES.includes(value);
const isFilled = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** update.create's and update.edit's stored version: the text `[title, content, type]` and the media. */
export interface UpdateContentProposal {
  title: string;
  content: string;
  type: CampaignUpdateType;
  mediaUrls: string[];
}

/** Null when the stored version is not a campaign update. */
export function parseUpdateContent(review: PublicationApplyReview): UpdateContentProposal | null {
  const value = parseJson(review.text);
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [title, content, type] = value as unknown[];
  if (!isFilled(title) || !isFilled(content) || !isUpdateType(type)) return null;
  if (!review.mediaUrls.every(isFilled)) return null;
  return { title, content, type, mediaUrls: [...review.mediaUrls] };
}
