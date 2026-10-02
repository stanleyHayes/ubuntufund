import { randomUUID } from 'node:crypto';
import type mongoose from 'mongoose';
import {
  AUTO_PUBLISH_ACTIONS, hasCurrentLegalAcceptance, isAutoPublishAction, isPublicationOutcomeReason,
  type PublicationOutcomeReason,
} from '@ubuntu-fund/types';
import type {
  ClaimedPublication, PublicationApplyStore, PublicationAuthorState, PublicationClaim, PublicationCommitResult, PublicationProgress,
  PublicationPublishOptions,
} from '../../../../domain/ports/outbound/PublicationApplyPort.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { LostPublicationLease, PublicationOutsideTransaction } from '../../inbound/middleware/publicationErrors.js';
import {
  MongoUnitOfWork, currentTransactionAttempt, currentTransactionLog, withTransactionLog,
  type TransactionAttempt, type TransactionLog,
} from './MongoUnitOfWork.js';
import { publishedNoticePath, recordPublicationNotice } from './publicationNotices.js';

/** The audit actor of everything the applier records. */
export const PUBLICATION_APPLIER_ACTOR = 'system:publication-applier';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const AUTO_ACTIONS = [...AUTO_PUBLISH_ACTIONS];
/** An attempt's lease, cleared whenever it ends. */
const LEASE_FIELDS = { publishNextAt: 1, publishLeaseUntil: 1, publishLeaseToken: 1 } as const;
/** Everything that makes an approval publish by itself; a released approval keeps none of it. */
const AUTO_PUBLISH_FIELDS = {
  ...LEASE_FIELDS, publishOnApproval: 1, credentialDigest: 1, publishState: 1, publishStateAt: 1, publishReason: 1, publishAttempts: 1,
} as const;

/** One handler commit (MongoPublicationApplyStore.commit): the transactions it committed, and where it published. */
interface PublicationCommit extends TransactionLog {
  /** The transaction run that recorded the publication; it counts only if that run committed. */
  publishedIn?: TransactionAttempt;
}

const NESTED = 'A transaction ran inside the one recording a publication; it would commit on its own, so it was refused';
const AFTER_ANOTHER = 'Another transaction of the commit committed before the publication was recorded; it must be recorded in the transaction that writes its content';

/** Fields `progress` and the projections read; never the digest or the lease token. */
interface PublicationRow {
  status?: string | null;
  publishState?: string | null;
  publishReason?: string | null;
  publishStateAt?: Date | null;
  closedAt?: Date | null;
}

const reasonOf = (value: unknown): { reason?: PublicationOutcomeReason } => (isPublicationOutcomeReason(value) ? { reason: value } : {});
const atOf = (value: Date | null | undefined): { at?: Date } => (value instanceof Date ? { at: value } : {});

/**
 * Where a version's publication stands, as the author and the decision
 * response see it: `queued` and `applying` read as publishing, and a version
 * closed before any decision (replaced or withdrawn) as its own state. Null
 * when publishing on approval never applied to it.
 */
export function publicationProgressOf(row: PublicationRow): PublicationProgress | null {
  if (row.status === 'superseded') return { state: 'superseded', reason: 'newer_version_submitted', ...atOf(row.closedAt) };
  if (row.status === 'withdrawn') return { state: 'withdrawn', reason: 'withdrawn_by_author', ...atOf(row.closedAt) };
  if (row.status !== 'approved') return null;
  switch (row.publishState) {
    case 'queued':
    case 'applying':
      return { state: 'publishing', ...atOf(row.publishStateAt) };
    case 'published':
      return { state: 'published', ...atOf(row.publishStateAt) };
    case 'not_published':
    case 'superseded':
    case 'withdrawn':
      return { state: row.publishState, ...reasonOf(row.publishReason), ...atOf(row.publishStateAt) };
    default:
      return null;
  }
}

/** The audit and the author's notice of an approved version that ended without being published. */
async function recordEnded(
  review: { id: string; action: string; actorId: string; reviewedAt?: Date; approvalExpiresAt?: Date | null },
  previous: string, state: 'not_published' | 'superseded', reason: PublicationOutcomeReason, now: Date,
): Promise<void> {
  await AuditLogModel.create({
    actorId: PUBLICATION_APPLIER_ACTOR, actorRole: 'system', action: `publication.${state}`, resource: review.id,
    details: state === 'superseded'
      ? `The approved ${review.action} was not published: it changed after it was submitted (${reason})`
      : `The approved ${review.action} was not published: ${reason}`,
    changes: [
      { field: 'publishState', before: previous, after: state },
      { field: 'publishReason', before: null, after: reason },
    ],
    severity: reason === 'unavailable' ? 'warning' : 'info', method: 'INTERNAL', path: `internal:publication.${state}`, statusCode: 200,
  });
  await recordPublicationNotice({
    reviewId: review.id, actorId: review.actorId, action: review.action, reviewedAt: review.reviewedAt,
    state, reason, approvalExpiresAt: review.approvalExpiresAt, now,
  });
}

type ClaimedRow = {
  _id: mongoose.Types.ObjectId; action: string; actorId: string; resourceId: string; baseVersion?: string | null; text: string; mediaUrls?: string[] | null;
  applyOptions?: { isPinned?: boolean | null } | null; reviewedBy?: string | null; reviewedAt?: Date | null; approvalExpiresAt?: Date | null;
  purgeAt?: Date | null; publishAttempts?: number | null; publishLeaseToken?: string | null; credentialDigest?: string | null;
};

/** The claim filter admits only publish-on-approval actions; a missing window reads as already over. */
function claimedOf(row: ClaimedRow, leaseToken: string): ClaimedPublication | null {
  if (!isAutoPublishAction(row.action)) return null;
  return {
    id: String(row._id), action: row.action, actorId: row.actorId, resourceId: row.resourceId,
    ...(typeof row.baseVersion === 'string' ? { baseVersion: row.baseVersion } : {}),
    text: row.text, mediaUrls: [...(row.mediaUrls ?? [])],
    ...(row.applyOptions ? { applyOptions: typeof row.applyOptions.isPinned === 'boolean' ? { isPinned: row.applyOptions.isPinned } : {} } : {}),
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    ...(row.reviewedAt instanceof Date ? { reviewedAt: row.reviewedAt } : {}),
    approvalExpiresAt: row.approvalExpiresAt instanceof Date ? row.approvalExpiresAt : new Date(0),
    purgeAt: row.purgeAt instanceof Date ? row.purgeAt : new Date(0),
    attempt: row.publishAttempts ?? 1, leaseToken,
    ...(row.credentialDigest ? { credentialDigest: row.credentialDigest } : {}),
  };
}

/**
 * The review records' side of publishing on approval. Every state change is
 * a compare-and-set on the attempt's lease token, so whichever of an
 * attempt, the author's own request, a withdrawal or a newer version writes
 * the record first wins and the others fail.
 */
export class MongoPublicationApplyStore implements PublicationApplyStore {
  private readonly uow = new MongoUnitOfWork();
  /** The handler commit each attempt is running (commit), for publish. */
  private readonly commits = new WeakMap<ClaimedPublication, PublicationCommit>();

  /** Waiting to publish with no attempt running: queued, or applying under a lease that expired (a crashed attempt). */
  private waitingFilter(now: Date) {
    return {
      status: 'approved', action: { $in: AUTO_ACTIONS }, publishOnApproval: true, publishState: { $in: ['queued', 'applying'] },
      publishNextAt: { $exists: true },
      $or: [{ publishLeaseUntil: { $exists: false } }, { publishLeaseUntil: { $lte: now } }],
    };
  }

  /** Due: waiting, and its time has come. */
  private dueFilter(now: Date) {
    return { ...this.waitingFilter(now), publishNextAt: { $exists: true, $lte: now } };
  }

  async claim(reviewId: string, now: Date, leaseMs: number): Promise<PublicationClaim> {
    if (!OBJECT_ID.test(reviewId)) return { progress: null };
    const leaseToken = randomUUID();
    const row = await PublicationReviewModel.findOneAndUpdate({ _id: reviewId, ...this.dueFilter(now) }, {
      $set: { publishState: 'applying', publishLeaseToken: leaseToken, publishLeaseUntil: new Date(now.getTime() + leaseMs) },
      $inc: { publishAttempts: 1 },
    }, { new: true }).select('+credentialDigest').lean();
    const claimed = row ? claimedOf(row as ClaimedRow, leaseToken) : null;
    return claimed ? { claimed } : { progress: await this.progress(reviewId) };
  }

  async due(now: Date, limit: number): Promise<string[]> {
    const rows = await PublicationReviewModel.find(this.dueFilter(now)).sort({ publishNextAt: 1 }).limit(limit).select('_id').lean();
    return rows.map(row => String(row._id));
  }

  async author(actorId: string): Promise<PublicationAuthorState | null> {
    if (!OBJECT_ID.test(actorId)) return null;
    const user = await UserModel.findById(actorId).select('role authVersion deletedAt legalAcceptance').lean();
    if (!user) return null;
    return {
      id: actorId, role: user.role ?? 'user', authVersion: user.authVersion ?? '', closed: !!user.deletedAt,
      restricted: !!(await ContentRestrictionModel.exists({ userId: actorId })),
      agreementAccepted: hasCurrentLegalAcceptance(user.legalAcceptance),
    };
  }

  /**
   * The handler's commit runs under a transaction log: a transaction started
   * inside another one is refused before it writes (it would commit on its
   * own), and the publication counts only if the transaction run that
   * recorded it is the run that committed.
   */
  async commit(claimed: ClaimedPublication, run: () => Promise<void>): Promise<PublicationCommitResult> {
    const commit: PublicationCommit = { committed: [], refuseNested: () => new PublicationOutsideTransaction(NESTED) };
    this.commits.set(claimed, commit);
    const published = () => !!commit.publishedIn && commit.committed.includes(commit.publishedIn);
    try {
      await withTransactionLog(commit, run);
      return { published: published() };
    } catch (error) {
      return { published: published(), error };
    } finally {
      this.commits.delete(claimed);
    }
  }

  async publish(claimed: ClaimedPublication, resourceId: string | undefined, options: PublicationPublishOptions): Promise<void> {
    const commit = this.commits.get(claimed);
    const attempt = currentTransactionAttempt();
    // In a MongoUnitOfWork transaction of this attempt's own commit, or not at all.
    if (!commit || currentTransactionLog() !== commit || !attempt) throw new PublicationOutsideTransaction();
    // Content another transaction already committed would stay if this one were rolled back.
    if (commit.committed.length) throw new PublicationOutsideTransaction(AFTER_ANOTHER);
    const now = new Date();
    const publishedResourceId = resourceId ?? claimed.resourceId;
    const result = await PublicationReviewModel.updateOne({
      _id: claimed.id, status: 'approved', publishState: 'applying', publishLeaseToken: claimed.leaseToken, approvalExpiresAt: { $gt: now },
    }, {
      $set: { publishState: 'published', publishedVia: 'approval', publishedResourceId, publishStateAt: now },
      $unset: { ...LEASE_FIELDS, publishReason: 1 },
      $inc: { consumptionWriteVersion: 1 },
    });
    if (!result.matchedCount) throw new LostPublicationLease();
    // Ids only: the content stays on the review record (and the item it changed).
    await AuditLogModel.create({
      actorId: PUBLICATION_APPLIER_ACTOR, actorRole: 'system', action: 'publication.published', resource: claimed.id,
      details: `Published ${claimed.action} on its approval (published resource ${publishedResourceId}, approved by ${claimed.reviewedBy ?? 'unknown'})`,
      changes: [
        { field: 'publishState', before: 'applying', after: 'published' },
        { field: 'publishedResourceId', before: null, after: publishedResourceId },
      ],
      severity: 'info', method: 'INTERNAL', path: 'internal:publication.published', statusCode: 200,
    });
    await recordPublicationNotice({
      reviewId: claimed.id, actorId: claimed.actorId, action: claimed.action, reviewedAt: claimed.reviewedAt, state: 'published', now,
      path: options.path ?? publishedNoticePath(claimed.action, claimed.resourceId),
    });
    // Last: it counts once this transaction run commits.
    commit.publishedIn = attempt;
  }

  finish(claimed: ClaimedPublication, state: 'not_published' | 'superseded', reason: PublicationOutcomeReason): Promise<boolean> {
    return this.uow.run(async () => {
      const now = new Date();
      const result = await PublicationReviewModel.updateOne(
        { _id: claimed.id, status: 'approved', publishState: 'applying', publishLeaseToken: claimed.leaseToken },
        { $set: { publishState: state, publishReason: reason, publishStateAt: now }, $unset: LEASE_FIELDS },
      );
      if (!result.modifiedCount) return false;
      await recordEnded(claimed, 'applying', state, reason, now);
      return true;
    });
  }

  async requeue(claimed: ClaimedPublication, nextAt: Date): Promise<boolean> {
    const result = await PublicationReviewModel.updateOne(
      { _id: claimed.id, status: 'approved', publishState: 'applying', publishLeaseToken: claimed.leaseToken },
      { $set: { publishState: 'queued', publishNextAt: nextAt }, $unset: { publishLeaseUntil: 1, publishLeaseToken: 1 } },
    );
    return result.modifiedCount > 0;
  }

  async releaseWaiting(now: Date, limit: number): Promise<number> {
    const rows = await PublicationReviewModel.find(this.waitingFilter(now)).sort({ publishNextAt: 1 }).limit(limit).select('_id').lean();
    let released = 0;
    // One at a time, each in its own transaction, like the attempts.
    for (const row of rows) if (await this.release(String(row._id), now)) released++;
    return released;
  }

  /**
   * One waiting approval, switched off: a plain approval from now on (what
   * the author is shown while it is off, and told now), or, once its approval
   * ran out, `not_published/approval_expired`. False when it changed meanwhile.
   */
  private release(reviewId: string, now: Date): Promise<boolean> {
    return this.uow.run(async () => {
      const row = await PublicationReviewModel.findOne({ _id: reviewId, ...this.waitingFilter(now) })
        .select('action actorId reviewedAt approvalExpiresAt publishState publishAttempts').lean();
      if (!row || !row.publishState) return false;
      const review = {
        id: reviewId, action: row.action, actorId: row.actorId,
        ...(row.reviewedAt instanceof Date ? { reviewedAt: row.reviewedAt } : {}),
        approvalExpiresAt: row.approvalExpiresAt ?? null,
      };
      const expired = !(row.approvalExpiresAt instanceof Date && row.approvalExpiresAt > now);
      const changed = await PublicationReviewModel.updateOne({ _id: reviewId, ...this.waitingFilter(now), publishState: row.publishState }, expired
        ? { $set: { publishState: 'not_published', publishReason: 'approval_expired', publishStateAt: now }, $unset: LEASE_FIELDS }
        : { $unset: AUTO_PUBLISH_FIELDS });
      if (!changed.modifiedCount) return false;
      if (expired) {
        await recordEnded(review, row.publishState, 'not_published', 'approval_expired', now);
        return true;
      }
      await AuditLogModel.create({
        actorId: PUBLICATION_APPLIER_ACTOR, actorRole: 'system', action: 'publication.returned_to_author', resource: reviewId,
        details: `Publishing on approval was switched off before the approved ${row.action} was published; its author publishes it by submitting it again`,
        changes: [
          { field: 'publishOnApproval', before: true, after: null },
          { field: 'publishState', before: row.publishState, after: null },
          ...(row.publishAttempts ? [{ field: 'publishAttempts', before: row.publishAttempts, after: null }] : []),
        ],
        severity: 'info', method: 'INTERNAL', path: 'internal:publication.returned_to_author', statusCode: 200,
      });
      // The notice a decision taken while switched off sends (the same key: never sent twice).
      await recordPublicationNotice({
        reviewId, actorId: review.actorId, action: review.action, reviewedAt: review.reviewedAt, state: 'approved', approvalExpiresAt: review.approvalExpiresAt, now,
      });
      return true;
    });
  }

  async progress(reviewId: string): Promise<PublicationProgress | null> {
    if (!OBJECT_ID.test(reviewId)) return null;
    const row = await PublicationReviewModel.findById(reviewId).select('status publishState publishReason publishStateAt closedAt').lean();
    return row ? publicationProgressOf(row) : null;
  }
}
