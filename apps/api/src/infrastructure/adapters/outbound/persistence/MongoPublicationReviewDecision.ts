import { isAutoPublishAction } from '@ubuntu-fund/types';
import type { PublicationApplierPort, PublicationProgress } from '../../../../domain/ports/outbound/PublicationApplyPort.js';
import { PublicationReviewModel } from '../../../database/models/PublicationReviewModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { CampaignUpdateModel } from '../../../database/models/CampaignUpdateModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { campaignManagerRole } from './campaignManagers.js';
import { publicationProgressOf } from './MongoPublicationApplyStore.js';
import { recordPublicationNotice } from './publicationNotices.js';
import { logger } from '../../../logging/logger.js';

const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** How long an approval authorizes the exact reviewed version (never past its record's deletion). */
const APPROVAL_TTL_MS = 7 * 86400000;
/** How long a decision waits for its publication before answering "publishing". */
export const PUBLICATION_DECISION_WAIT_MS = 8_000;
/** Actions whose resourceId is the campaign; update.edit reaches its campaign through the update. */
const CAMPAIGN_ACTIONS = new Set(['comment.create', 'update.create', 'live.start', 'campaign.slug', 'thank_you.send']);
/** Actions whose resourceId is the account the change is for (a campaign proposal: its creator). */
const ACCOUNT_ACTIONS = new Set(['account.profile', 'creator.profile', 'organization.profile', 'campaign.create']);
/** Why a decision was refused, for the admin card's title (`errors.review`). */
const DECIDED = { review: ['decided'] };
const CONFLICT = 'Another administrator must review content for a campaign or organization you manage';

export interface PublicationReviewDecisionInput {
  reviewId: string;
  /** The deciding administrator. */
  staffId: string;
  /** The credential version their request was authenticated with ('' when it never rotated). */
  authVersion?: string;
  decision: 'approved' | 'rejected';
  notes: string;
}

export interface PublicationReviewDecisionResult {
  reviewed: true;
  /**
   * This approval publishes the version by itself (publishing on approval),
   * by the same rule as the review lists: never while switched off.
   */
  publishOnApproval: boolean;
  /**
   * Where its publication stands: `publishing` (only when publishOnApproval)
   * while it is still running, or where it ended, whoever published it (a
   * repeated decision on a version its author has published since, say).
   */
  publication?: PublicationProgress;
}

export interface PublicationReviewDecisionOptions {
  applier?: PublicationApplierPort;
  /** PUBLISH_ON_APPROVAL_ENABLED: while off, approvals never enqueue a publication. */
  publishOnApproval?: () => boolean;
  /** How long to wait for the publication before answering; it carries on afterwards. */
  waitMs?: number;
}

type ReviewRow = {
  _id: unknown; actorId: string; action: string; resourceId: string; status: string; reviewedBy?: string | null; reviewNotes?: string | null;
  publishOnApproval?: boolean | null; publishState?: string | null; publishNextAt?: Date | null; purgeAt?: Date | null;
  publishReason?: string | null; publishStateAt?: Date | null; closedAt?: Date | null;
};

interface Decided {
  reviewId: string;
  publishes: boolean;
  /** An attempt is due now: a fresh approval, or a retry that finds one waiting. */
  attemptNow: boolean;
  progress: PublicationProgress | null;
}

const TIMED_OUT = Symbol('timed out');

/** `work` or TIMED_OUT, whichever comes first; `work` carries on either way. */
async function within<T>(work: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>(resolve => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
    timer.unref?.();
  });
  try { return await Promise.race([work, timeout]); }
  finally { clearTimeout(timer); }
}

/**
 * Whether the reviewer manages what the version is for: an organization they
 * are or belong to (in any role) that wrote the version, or whose account it
 * changes; or a campaign they own, help run (an active admin or editor of its
 * organization) or benefit from. Approving and declining alike.
 */
async function managesSubjectOf(row: ReviewRow, staffId: string): Promise<boolean> {
  // Content an organization publishes under its own name is the organization's, whatever it is about.
  const accounts = [...new Set([row.actorId, ...(ACCOUNT_ACTIONS.has(row.action) ? [row.resourceId] : [])])];
  if (accounts.includes(staffId)) return true;
  if (await OrganizationMemberModel.exists({ organizationId: { $in: accounts }, userId: staffId, status: 'active' })) return true;
  let campaignId: string | undefined;
  if (row.action === 'update.edit') {
    const update = OBJECT_ID.test(row.resourceId) ? await CampaignUpdateModel.findById(row.resourceId).select('campaignId').lean() : null;
    campaignId = update?.campaignId;
  } else if (CAMPAIGN_ACTIONS.has(row.action)) {
    campaignId = row.resourceId;
  }
  if (!campaignId || !OBJECT_ID.test(campaignId)) return false;
  const campaign = await CampaignModel.findById(campaignId).select('creatorId onBehalf.beneficiaryUserId').lean();
  if (!campaign) return false;
  if (campaign.creatorId === staffId || campaign.onBehalf?.beneficiaryUserId === staffId) return true;
  return !!(await campaignManagerRole(campaign, staffId));
}

/**
 * `PUT /admin/publication-reviews/:id/review`. One transaction: the
 * administrator's current access (a fenced write), the conflict-of-interest
 * rule, the decision (a compare-and-set on the waiting version), its audit,
 * and the author's notice, or, when the approval publishes the version by
 * itself, its queued publication. The publication runs after the commit and
 * the answer waits for it a few seconds. A committed decision is never
 * answered with an error.
 */
export class MongoPublicationReviewDecision {
  private readonly uow = new MongoUnitOfWork();
  private readonly publishOnApproval: () => boolean;
  private readonly waitMs: number;

  constructor(private readonly options: PublicationReviewDecisionOptions = {}) {
    this.publishOnApproval = options.publishOnApproval ?? (() => false);
    this.waitMs = options.waitMs ?? PUBLICATION_DECISION_WAIT_MS;
  }

  async decide(input: PublicationReviewDecisionInput): Promise<PublicationReviewDecisionResult> {
    const decided = await this.uow.run(() => this.record(input));
    if (!decided.publishes) return { reviewed: true, publishOnApproval: false, ...(decided.progress ? { publication: decided.progress } : {}) };
    return { reviewed: true, publishOnApproval: true, publication: await this.publication(decided) };
  }

  /**
   * Whether this approval publishes the version by itself: the same rule as
   * the first answer and the review lists. Only an approval that queued a
   * publication keeps `publishOnApproval` (record clears it otherwise), and
   * nothing publishes by itself while switched off.
   */
  private publishesByItself(row: ReviewRow): boolean {
    return row.status === 'approved' && isAutoPublishAction(row.action) && row.publishOnApproval === true && this.publishOnApproval();
  }

  /** The same decision again (a retried request): where it stands, attempting it if it is due. */
  private retried(row: ReviewRow, reviewId: string, now: Date): Decided {
    const publishes = this.publishesByItself(row);
    const progress = publicationProgressOf(row);
    const waiting = row.publishState === 'queued' && !!row.publishNextAt && row.publishNextAt.getTime() <= now.getTime();
    return {
      reviewId, publishes, attemptNow: publishes && waiting,
      // Publishing reads as a plain approval unless this approval publishes it by itself; where it ended always shows.
      progress: progress && (publishes || progress.state !== 'publishing') ? progress : null,
    };
  }

  private async record(input: PublicationReviewDecisionInput): Promise<Decided> {
    // A real write serializes this decision with a concurrent demotion, closure or credential change.
    const staff = await UserModel.findOneAndUpdate({
      _id: input.staffId, role: 'admin', deletedAt: null,
      ...(input.authVersion ? { authVersion: input.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
    }, { $inc: { staffActionVersion: 1 } }, { new: true });
    if (!staff) throw new AppError('Current administrator access is required', 403);
    if (!OBJECT_ID.test(input.reviewId)) throw new AppError('Publication review not found', 404);
    const row = await PublicationReviewModel.findById(input.reviewId).lean() as ReviewRow | null;
    if (!row) throw new AppError('Publication review not found', 404);
    const reviewId = String(input.reviewId);
    if (row.actorId === input.staffId) throw new AppError('Another administrator must review your content', 403);
    if (await managesSubjectOf(row, input.staffId)) throw new AppError(CONFLICT, 403, { review: ['conflict'] });
    const now = new Date();

    if (row.status !== 'pending') {
      if (row.status === input.decision && row.reviewedBy === input.staffId && row.reviewNotes === input.notes) return this.retried(row, reviewId, now);
      // Closed before any decision: nobody decided it, so it must not read as "already decided".
      if (row.status === 'withdrawn') throw new AppError('The author withdrew this version.', 409, { review: ['withdrawn'] });
      if (row.status === 'superseded') throw new AppError('The author replaced this version with a newer one.', 409, { review: ['superseded'] });
      throw new AppError('A final decision already exists for this version', 409, DECIDED);
    }

    const approved = input.decision === 'approved';
    // Versions submitted before publishing on approval, or while it was off,
    // keep "approve, then the author submits again" for good.
    const publishes = approved && isAutoPublishAction(row.action) && row.publishOnApproval === true && this.publishOnApproval();
    // An approval never outlives its record.
    const approvalExpiresAt = approved ? new Date(Math.min(now.getTime() + APPROVAL_TTL_MS, row.purgeAt?.getTime() ?? Infinity)) : undefined;
    const changed = await PublicationReviewModel.updateOne({ _id: row._id, status: 'pending' }, {
      $set: {
        status: input.decision, reviewedBy: input.staffId, reviewedAt: now, reviewNotes: input.notes,
        ...(approvalExpiresAt ? { approvalExpiresAt } : {}),
        ...(publishes ? { publishState: 'queued', publishNextAt: now, publishAttempts: 0, publishStateAt: now } : {}),
      },
      // A decision that queues no publication leaves a plain decision: nothing
      // on it claims to publish by itself (lists, retries), and the credential
      // digest kept only for that is dropped.
      $unset: publishes
        ? { publishReason: 1, publishLeaseUntil: 1, publishLeaseToken: 1, publishedVia: 1, publishedResourceId: 1 }
        : { publishOnApproval: 1, credentialDigest: 1 },
    });
    if (!changed.modifiedCount) throw new AppError('Another reviewer already decided this submission', 409, DECIDED);
    await AuditLogModel.create({
      actorId: input.staffId, actorRole: 'admin', action: `publication.${input.decision}`, resource: reviewId,
      details: `Publication version reviewed; publishes on approval: ${publishes ? 'yes' : 'no'}`, reason: input.notes,
      severity: 'info', method: 'PUT', path: '/admin/publication-reviews/:id/review', statusCode: 200,
    });
    // A version that publishes by itself is told how publishing ended instead.
    if (!publishes) {
      await recordPublicationNotice({
        reviewId, actorId: row.actorId, action: row.action, reviewedAt: now, state: approved ? 'approved' : 'declined', approvalExpiresAt, now,
        // The host starts an approved live session from its page.
        ...(approved && row.action === 'live.start' ? { path: `/campaigns/${row.resourceId}/live` } : {}),
      });
    }
    return { reviewId, publishes, attemptNow: publishes, progress: publishes ? { state: 'publishing', at: now } : null };
  }

  /** After the commit: one attempt now, answered within the wait; never an error. */
  private async publication(decided: Decided): Promise<PublicationProgress> {
    const fallback = decided.progress ?? { state: 'publishing' as const };
    if (!decided.attemptNow || !this.options.applier) return fallback;
    try {
      const outcome = await within(this.options.applier.applyNow(decided.reviewId), this.waitMs);
      if (outcome === TIMED_OUT) return { state: 'publishing', ...(fallback.at ? { at: fallback.at } : {}) };
      return outcome ?? fallback;
    } catch (error) {
      logger.error({ event: 'publication.apply', reviewId: decided.reviewId, errName: error instanceof Error ? error.name : 'Error' }, 'Publication after a decision failed to start');
      return fallback;
    }
  }
}
