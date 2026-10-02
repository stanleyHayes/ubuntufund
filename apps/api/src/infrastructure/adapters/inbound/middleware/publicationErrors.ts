import {
  PUBLICATION_ALREADY_PUBLISHED, PUBLICATION_HELD, PUBLISHES_ON_APPROVAL,
  type PublicationOutcomeReason,
} from '@ubuntu-fund/types';
import { AppError } from './errorHandler.js';

/**
 * Errors of the publication review: a version held for review, a version that
 * is already published, and the internal signals of publishing on approval.
 * Clients recognise a hold by `errors.publication` containing `held` or by
 * the message prefix (isPublicationHeld in both clients' publicationDrafts).
 */

/** Kept on every held message: older clients detect a hold by it. */
export const HELD_MESSAGE_PREFIX = 'Saved privately for safety review.';

/** The author submits the same version again after it is approved (live sessions, and versions held before publishing on approval). */
export const HELD_MESSAGE = `${HELD_MESSAGE_PREFIX} Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.`;

/** Published automatically once approved, after the author's checks run again. */
export const HELD_PUBLISHES_ON_APPROVAL_MESSAGE = `${HELD_MESSAGE_PREFIX} Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.`;

/**
 * A version waiting for review: 409 with `errors.publication` `['held']`, plus
 * `publishes_on_approval` when the approval publishes it without the author
 * submitting it again. Clients show it as a neutral notice, not a failure.
 */
export function publicationHeld(publishesOnApproval: boolean, errors: Record<string, string[]> = {}): AppError {
  return publishesOnApproval
    ? new AppError(HELD_PUBLISHES_ON_APPROVAL_MESSAGE, 409, { ...errors, publication: [PUBLICATION_HELD, PUBLISHES_ON_APPROVAL] })
    : new AppError(HELD_MESSAGE, 409, { ...errors, publication: [PUBLICATION_HELD] });
}

/** True for a held version (either kind), e.g. to save private edits before passing the hold on. */
export function isPublicationHeldError(error: unknown): error is AppError {
  return error instanceof AppError && error.statusCode === 409 && !!error.errors?.publication?.includes(PUBLICATION_HELD);
}

/**
 * This exact version is already published: approvals of the publish-on-
 * approval actions are single-use. `resourceId` is what the publication
 * created or changed (a comment or update id, a queued thank-you message, or
 * the item itself) when it is known, so a create-type caller can return the
 * existing record to a client that repeats the request.
 */
export class PublicationAlreadyPublished extends AppError {
  constructor(public readonly resourceId?: string) {
    super('This version is already published.', 409, { publication: [PUBLICATION_ALREADY_PUBLISHED] });
  }
}

/**
 * `AppError.code` values a publishing write tags its fences with, so
 * publishing on approval can tell an expected refusal from a failure:
 * `account_session` (401: account closed or credentials changed),
 * `terms_required` and `organization_terms_required` (428),
 * `publishing_restricted` and `permission_changed` (403),
 * `campaign_unavailable` (409: the campaign closed or changed hands) and
 * `stale_version` (409: the item changed since the version was proposed).
 */
export const PUBLICATION_FENCE_CODES = [
  'account_session', 'terms_required', 'organization_terms_required',
  'publishing_restricted', 'permission_changed', 'campaign_unavailable', 'stale_version',
] as const;
export type PublicationFenceCode = (typeof PUBLICATION_FENCE_CODES)[number];

export const isPublicationFenceCode = (code: unknown): code is PublicationFenceCode =>
  typeof code === 'string' && (PUBLICATION_FENCE_CODES as readonly string[]).includes(code);

/**
 * The outcome a fence refusal ends a publication attempt with. For
 * `account_session` the caller reads the author again: a closed account is
 * `account_unavailable`, an open one `credentials_changed` (returned here).
 */
export function publicationFenceOutcome(code: PublicationFenceCode): { state: 'not_published' | 'superseded'; reason: PublicationOutcomeReason } {
  switch (code) {
    case 'account_session': return { state: 'not_published', reason: 'credentials_changed' };
    case 'terms_required': return { state: 'not_published', reason: 'terms_not_accepted' };
    case 'organization_terms_required': return { state: 'not_published', reason: 'organization_terms_not_accepted' };
    case 'publishing_restricted': return { state: 'not_published', reason: 'restricted' };
    case 'permission_changed': return { state: 'not_published', reason: 'permission_changed' };
    case 'campaign_unavailable': return { state: 'not_published', reason: 'campaign_unavailable' };
    case 'stale_version': return { state: 'superseded', reason: 'edited_since_submitted' };
  }
}

/**
 * Thrown inside a publication's own transaction to end the attempt with an
 * expected outcome (the transaction rolls back; the approval stands). Never
 * reaches an HTTP response.
 */
export class PublicationApplyRefusal extends Error {
  constructor(public readonly state: 'not_published' | 'superseded', public readonly reason: PublicationOutcomeReason) {
    super(`Publication not applied: ${reason}`);
    this.name = 'PublicationApplyRefusal';
  }
}

/**
 * The publishing attempt no longer holds the review: it was published,
 * withdrawn or superseded meanwhile, or another attempt took over. Rolls back
 * the content written in the same transaction; nothing else is recorded.
 */
export class LostPublicationLease extends Error {
  constructor() {
    super('The publication attempt lost its lease');
    this.name = 'LostPublicationLease';
  }
}

/**
 * A publication handler did not record the publication in the transaction
 * that writes its content: outside any transaction, after another transaction
 * of its commit had already committed, or with a transaction run inside the
 * publishing one (refused before it writes: it would commit on its own). Its
 * content and the review's move to `published` could not commit together. A
 * programming error: the attempt is never retried (that could write the
 * content again) and ends as `not_published/unavailable`.
 */
export class PublicationOutsideTransaction extends Error {
  constructor(message = 'A publication must be recorded inside the transaction that writes it') {
    super(message);
    this.name = 'PublicationOutsideTransaction';
  }
}
