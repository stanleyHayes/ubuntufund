import { publicationOutcomeCopy, type PublicationNoticeState } from '@ubuntu-fund/types';
import { recordStaffDecisionNotice, type StaffDecisionNotice } from './MongoStaffDecisionNotices.js';

/**
 * The author's in-app notices about a held version: the staff decision when
 * it does not publish by itself, and how publishing on approval ended. Inbox
 * only, never email. The words come from @ubuntu-fund/types
 * (publicationOutcomeCopy), the single source the clients share. A notice
 * never carries the content, the reviewer's note or the credential digest.
 */

/** Where an author follows their reviews (the native app resolves it to Settings). */
export const PUBLICATION_REVIEWS_PATH = '/settings#privacy';

/**
 * Deadlines in notices, e.g. "9 Oct 2026, 14:05 GMT". Ghana time, which is
 * GMT all year; the account's own locale is not known when a notice is written.
 */
const DEADLINE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  timeZone: 'Africa/Accra', timeZoneName: 'short',
});
export const formatPublicationDeadline = (date: Date): string => DEADLINE.format(date);

/**
 * Where "it's live" links, by action. An edited campaign update names its
 * campaign through PublicationApplyContext.publish (only its handler knows it);
 * until then it links to the reviews.
 */
export function publishedNoticePath(action: string, resourceId: string): string {
  switch (action) {
    case 'comment.create':
    case 'update.create':
    case 'campaign.slug':
      return `/campaigns/${resourceId}`;
    case 'thank_you.send':
      return `/campaigns/${resourceId}/thank-you`;
    case 'account.profile':
      return '/profile';
    case 'organization.profile':
      return '/organization-team';
    case 'creator.profile':
      return '/creator';
    default:
      return PUBLICATION_REVIEWS_PATH;
  }
}

export interface PublicationNoticeInput {
  reviewId: string;
  /** The author: the notice goes to whoever submitted the version. */
  actorId: string;
  action: string;
  /** The decision's time; with the id it keys the notice, so one decision never notifies twice. */
  reviewedAt?: Date | null;
  /** `declined` and `approved` are the decision itself; the others are how publishing on approval ended. */
  state: PublicationNoticeState;
  reason?: string;
  /** While it lasts, the deadline for publishing the same version by submitting it again. */
  approvalExpiresAt?: Date | null;
  /** Defaults to the author's reviews. */
  path?: string;
  now?: Date;
}

export function publicationNotice(input: PublicationNoticeInput): StaffDecisionNotice {
  const now = input.now ?? new Date();
  const deadline = input.approvalExpiresAt && input.approvalExpiresAt.getTime() > now.getTime() ? formatPublicationDeadline(input.approvalExpiresAt) : undefined;
  const copy = publicationOutcomeCopy({ action: input.action, state: input.state, reason: input.reason, deadline });
  const kind = input.state === 'declined' || input.state === 'approved' ? 'decision' : input.state;
  return {
    key: `publication-review:${input.reviewId}:${input.reviewedAt?.getTime() ?? 0}:${kind}`,
    userId: input.actorId, title: copy.title, body: copy.body, path: input.path ?? PUBLICATION_REVIEWS_PATH,
  };
}

/** Joins the surrounding transaction; skipped for a closed account. */
export function recordPublicationNotice(input: PublicationNoticeInput): Promise<void> {
  return recordStaffDecisionNotice(publicationNotice(input));
}
