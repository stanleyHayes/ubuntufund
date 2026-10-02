import type { AutoPublishAction, PublicationOutcomeReason, PublicationOutcomeState } from '@ubuntu-fund/types';

/**
 * Publishing on approval (docs/compliance/PUBLICATION_REVIEWS.md): a staff
 * approval of a held version publishes that exact version by itself, as if
 * its author had submitted it again at that moment. Every check of the
 * author's own request runs again, inside the action's own transaction, plus
 * an unchanged-credentials check. Expected refusals end the attempt with a
 * recorded outcome; they never undo the approval.
 */

/** An approved version as one publication attempt sees it. */
export interface PublicationApplyReview {
  id: string;
  action: AutoPublishAction;
  actorId: string;
  resourceId: string;
  /** The item version the change was proposed against, when the action has one. */
  baseVersion?: string;
  /** The stored proposal, exactly as reviewed. */
  text: string;
  mediaUrls: string[];
  /** update.create only: how the approval publishes it. Not reviewed content. */
  applyOptions?: { isPinned?: boolean };
  reviewedBy?: string;
  reviewedAt?: Date;
  approvalExpiresAt: Date;
  /** When the review record is deleted (TTL). */
  purgeAt: Date;
  /** This attempt's number, from 1. */
  attempt: number;
}

/** The author as this attempt read them, after the common checks passed. */
export interface PublicationApplyAuthor {
  id: string;
  role: string;
  /**
   * The current raw credential version ('' when it never rotated). Pass it
   * to the action's writer fences, which re-check it inside the transaction:
   * a rotation after the check fails the fence.
   */
  authVersion: string;
}

export interface PublicationPublishOptions {
  /** Where the author's "it's live" notice links. Defaults per action (see publicationNotices). */
  path?: string;
}

export interface PublicationApplyContext<P = unknown> {
  readonly review: PublicationApplyReview;
  /** What `parse` returned. */
  readonly proposal: P;
  readonly author: PublicationApplyAuthor;
  /**
   * Call once, inside the action's own transaction, right after its write:
   * records the version as published by its approval (compare-and-set on
   * this attempt's lease), audits it and queues the author's notice, all in
   * that transaction. `resourceId`: what the publication created or changed
   * (a comment or update id, the queued thank-you message), defaulting to the
   * item itself. Throws LostPublicationLease when the attempt no longer holds
   * the version (published, withdrawn or superseded meanwhile, or another
   * attempt took over); let it propagate so the whole transaction aborts.
   *
   * Throws PublicationOutsideTransaction (the attempt ends as
   * `not_published/unavailable`, never retried) unless it is called in a
   * MongoUnitOfWork transaction of the commit, before any other transaction
   * of the commit committed.
   */
  publish(resourceId?: string, options?: PublicationPublishOptions): Promise<void>;
}

/**
 * Publishes one action on approval. Implementations reuse the action's own
 * transactional writer, so the same closure, restriction, agreement, role,
 * delegation, plan and revision checks apply as to the author's request.
 *
 * Refuse an expected outcome by throwing PublicationApplyRefusal(state,
 * reason), or let a writer fence throw its tagged AppError (`code`, see
 * PUBLICATION_FENCE_CODES). Anything else is retried with backoff. A commit
 * must either call `context.publish` inside its transaction or throw.
 *
 * One transaction writes the content and records the publication: call the
 * writer's own transactional `run` (or one `uow.run`) and `context.publish`
 * inside its callback. Never wrap a writer that opens its own transaction in
 * another transaction: Mongoose gives it its own session, so it would commit
 * on its own whatever happens to the publication. Such a nested transaction
 * is refused before it writes, and a publication recorded after another
 * transaction of the commit committed is refused; both end the attempt as
 * `not_published/unavailable`. The callback may run more than once (the
 * driver retries transient errors): it must publish on every run that
 * commits. Only a run that publishes and commits counts as published.
 *
 * Every action's suite includes a real-handler race: pause right after the
 * domain write, let the author publish the same version themselves (or
 * withdraw it), resume, and assert that nothing more was committed.
 */
export interface PublicationApplyHandler<P = unknown> {
  readonly action: AutoPublishAction;
  /** Reads the stored proposal. Null (or a throw) ends the attempt as `not_published/unreadable`. */
  parse(review: PublicationApplyReview): P | null;
  /** Action-specific reads before the commit (outside any transaction). */
  precheck?(context: PublicationApplyContext<P>): Promise<void>;
  /** Runs the action's own transactional write and calls `context.publish` inside it. */
  commit(context: PublicationApplyContext<P>): Promise<void>;
}

/** The handler of each publish-on-approval action, by action. */
export type PublicationApplyHandlers = ReadonlyMap<string, PublicationApplyHandler>;

/** Where an approved version's publication stands, for the author and the decision response. */
export interface PublicationProgress {
  state: PublicationOutcomeState;
  reason?: PublicationOutcomeReason;
  at?: Date;
}

/** A version this attempt holds the lease on. */
export interface ClaimedPublication extends PublicationApplyReview {
  leaseToken: string;
  /** Digest of the credential version the author submitted with; absent on older records. */
  credentialDigest?: string;
}

/** The author's current state for the checks every publication repeats. */
export interface PublicationAuthorState {
  id: string;
  role: string;
  /** Raw credential version, '' when it never rotated. */
  authVersion: string;
  closed: boolean;
  restricted: boolean;
  /** Accepted the current account agreement (staff never need to). */
  agreementAccepted: boolean;
}

export type PublicationClaim =
  | { claimed: ClaimedPublication }
  | { claimed?: undefined; progress: PublicationProgress | null };

/** What a handler's commit did for this attempt's publication. */
export type PublicationCommitResult =
  /** `published`: this attempt's publication committed (recorded by `publish` in the run that then committed). */
  | { published: boolean }
  /** The commit threw `error`; `published` says whether the publication had already committed. */
  | { published: boolean; error: unknown };

/** Persistence of publication attempts. Every write is a compare-and-set on the attempt's lease. */
export interface PublicationApplyStore {
  /**
   * Atomically takes the lease on a version that is due (queued, or applying
   * with an expired lease), counting the attempt. When it is not due, returns
   * where it stands instead (null when the record is gone).
   */
  claim(reviewId: string, now: Date, leaseMs: number): Promise<PublicationClaim>;
  /** Ids of versions due for an attempt, the longest waiting first. */
  due(now: Date, limit: number): Promise<string[]>;
  /** The author's current state, or null when the account no longer exists. */
  author(actorId: string): Promise<PublicationAuthorState | null>;
  /**
   * Runs a handler's commit for this attempt and reports whether this
   * attempt's publication is what committed: a run of the transaction that
   * recorded it and was then rolled back (a transient error, the callback
   * run again without publishing) does not count. Never throws; reports what
   * the commit threw instead.
   */
  commit(claimed: ClaimedPublication, run: () => Promise<void>): Promise<PublicationCommitResult>;
  /** See PublicationApplyContext.publish. Only valid inside `commit`, in the handler's transaction. */
  publish(claimed: ClaimedPublication, resourceId: string | undefined, options: PublicationPublishOptions): Promise<void>;
  /**
   * Ends the attempt with an outcome, audited and told to the author in one
   * transaction. False when the attempt no longer held the version.
   */
  finish(claimed: ClaimedPublication, state: 'not_published' | 'superseded', reason: PublicationOutcomeReason): Promise<boolean>;
  /** Releases the lease for another attempt at `nextAt`. False when the attempt no longer held the version. */
  requeue(claimed: ClaimedPublication, nextAt: Date): Promise<boolean>;
  /**
   * Publishing on approval is switched off: approvals still waiting to
   * publish, with no attempt running, become plain approvals their authors
   * publish by submitting them again, exactly as if decided while it was off
   * (audited, and the author is told, with the deadline). One whose approval
   * already ran out ends as `not_published/approval_expired` instead. Up to
   * `limit` versions; returns how many it released.
   */
  releaseWaiting(now: Date, limit: number): Promise<number>;
  /** Where a version stands now (null when the record is gone). */
  progress(reviewId: string): Promise<PublicationProgress | null>;
}

/** Runs publication attempts. */
export interface PublicationApplierPort {
  /** One attempt at this version when it is due. Never throws; returns where it stands afterwards (null when gone). */
  applyNow(reviewId: string): Promise<PublicationProgress | null>;
  /**
   * Attempts a batch of due versions; returns how many it tried. While
   * switched off it attempts nothing and releases waiting approvals to their
   * authors instead (PublicationApplyStore.releaseWaiting), returning how many.
   */
  sweep(): Promise<number>;
}
