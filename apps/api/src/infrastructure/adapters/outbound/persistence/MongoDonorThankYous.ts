import { createHash, createHmac, hkdfSync, randomUUID, timingSafeEqual } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  CampaignStatus,
  DONOR_THANK_YOU_LIMITS,
  hasCurrentLegalAcceptance,
  type DonorThankYouBlockReason,
  type DonorThankYouContent,
  type DonorThankYouPreview,
  type DonorThankYouState,
  type DonorThankYouView,
} from '@ubuntu-fund/types';
import { CampaignModel, type CampaignDocument } from '../../../database/models/CampaignModel.js';
import { DonationIntentModel } from '../../../database/models/DonationIntentModel.js';
import { PayoutModel } from '../../../database/models/PayoutModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { DonorThankYouModel, type DonorThankYouDocument } from '../../../database/models/DonorThankYouModel.js';
import { DonorThankYouDeliveryModel, type DonorThankYouDeliveryDocument } from '../../../database/models/DonorThankYouDeliveryModel.js';
import { DonorMessageSuppressionModel } from '../../../database/models/DonorMessageSuppressionModel.js';
import type { PublicationAdmissionPort, PublicationSubmission } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { ActivityEmailSender } from './MongoActivityAlerts.js';
import type { ThankYouSettings } from '../../../../application/services/CommercialConfigService.js';
import { AppError, isDuplicateKeyError } from '../../inbound/middleware/errorHandler.js';
import { EmailDeliveryError } from '../ResendActivityEmails.js';
import { renderEmail } from '../emailTemplate.js';
import { MongoCampaignCreation } from './MongoCampaignCreation.js';
import { campaignManagerRole, organizerName, recordAccountNotice } from './campaignManagers.js';
import { logger } from '../../../logging/logger.js';

/** Donations that still count: paid, possibly partly refunded. Refunds, disputes and chargebacks do not. */
const ELIGIBLE_STATUSES = ['SUCCEEDED', 'PARTIALLY_REFUNDED'];
const MAX_AUTOMATIC_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60];
/** Resend keeps idempotency keys for 24 h; past this an unknown outcome is never blindly resent. */
const IDEMPOTENCY_WINDOW_MS = 23 * 3600_000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();
/** Subject lines are single-line: a CR/LF there would let text rewrite email headers. */
const oneLine = (value: string) => value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
/** Body text keeps line breaks but drops other control characters. */
const cleanBody = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

function cleanContent(content: DonorThankYouContent): DonorThankYouContent {
  const subject = oneLine(content.subject ?? '');
  const body = cleanBody(content.body ?? '');
  const signature = oneLine(content.signature ?? '');
  if (subject.length < 3 || subject.length > DONOR_THANK_YOU_LIMITS.subject) throw new AppError(`The subject must be 3–${DONOR_THANK_YOU_LIMITS.subject} characters.`, 422);
  if (body.length < 10 || body.length > DONOR_THANK_YOU_LIMITS.body) throw new AppError(`The message must be 10–${DONOR_THANK_YOU_LIMITS.body} characters.`, 422);
  if (signature.length > DONOR_THANK_YOU_LIMITS.signature) throw new AppError(`The signature can be up to ${DONOR_THANK_YOU_LIMITS.signature} characters.`, 422);
  return { subject, body, signature };
}

const REASON_MESSAGES: Record<DonorThankYouBlockReason, string> = {
  disabled: 'Thank-you messages are turned off right now.',
  not_authorized: 'Only the campaign organizer or its beneficiary can thank donors.',
  not_ended: 'You can thank donors once the campaign has ended or a payout has been paid.',
  campaign_unavailable: 'This campaign is under review, so messages to donors are paused.',
  no_donors: 'This campaign has no donors to thank yet.',
  limit_reached: 'This campaign has already sent its thank-you message.',
  email_unavailable: 'Email delivery is temporarily unavailable. Your draft is saved; try again later.',
};

/**
 * The code each refusal carries (AppError.code), so publishing on approval
 * can tell an expected refusal from a failure: the publication fence codes,
 * or the outcome reason itself. Email that is not configured yet is no
 * refusal there: queued messages wait for it.
 */
const REASON_CODES: Partial<Record<DonorThankYouBlockReason, string>> = {
  disabled: 'thank_you_disabled',
  not_authorized: 'permission_changed',
  not_ended: 'thank_you_not_eligible',
  campaign_unavailable: 'campaign_unavailable',
  no_donors: 'thank_you_no_donors',
  limit_reached: 'thank_you_limit_reached',
};

const blocked = (reason: DonorThankYouBlockReason) =>
  new AppError(REASON_MESSAGES[reason], reason === 'email_unavailable' ? 503 : 409, undefined, REASON_CODES[reason]);
const campaignGone = () => new AppError('Campaign not found', 404, undefined, 'campaign_unavailable');
const draftChanged = () => new AppError('Your draft changed while it was being checked. Review it and send again.', 409, undefined, 'stale_version');
const roleChanged = () => new AppError('You no longer manage or benefit from this campaign, so you cannot thank its donors.', 403, undefined, 'permission_changed');
const actorRestricted = () => new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403, undefined, 'publishing_restricted');
const ownerRestricted = () => new AppError("Publishing is restricted for this campaign's organizer, so messages to its donors are paused.", 403, undefined, 'organizer_restricted');

const sameContent = (draft: DonorThankYouDocument, content: DonorThankYouContent) =>
  draft.subject === content.subject && draft.body === content.body && (draft.signature ?? '') === (content.signature ?? '');

function toView(doc: DonorThankYouDocument): DonorThankYouView {
  return {
    id: doc._id.toString(), campaignId: doc.campaignId, status: doc.status, authorRole: doc.authorRole,
    subject: doc.subject, body: doc.body, signature: doc.signature,
    recipientCount: doc.recipientCount, sentCount: doc.sentCount, failedCount: doc.failedCount,
    skippedCount: doc.skippedCount, retryableCount: doc.retryableCount,
    submittedAt: doc.submittedAt?.toISOString(), completedAt: doc.completedAt?.toISOString(), updatedAt: doc.updatedAt.toISOString(),
  };
}

interface Actor { userId: string; authVersion?: string }

type ThankYouRole = 'manager' | 'beneficiary';

/** What queues a message (MongoDonorThankYous.queueInTransaction). */
export interface ThankYouQueueRequest {
  actorId: string;
  campaignId: string;
  /** The exact message: the campaign's draft must still hold it. */
  content: DonorThankYouContent;
  /** The draft the author sent with their own request; an approval finds the draft by its content. */
  draftId?: string;
  /** Unique per campaign: the client's key, or `publication-review-<reviewId>` for an approval. */
  idempotencyKey: string;
  settings: ThankYouSettings;
  /** The approval (publication review) that queues it; absent for the author's own request. */
  reviewId?: string;
}

export interface QueuedThankYou {
  view: DonorThankYouView;
  role: ThankYouRole;
  estimatedRecipients: number;
}

/** A held message a staff approval queues (publishing on approval). */
export interface ApprovedThankYou {
  reviewId: string;
  actorId: string;
  /** The author's current raw credential version; the publisher fence re-checks it. */
  authVersion: string;
  campaignId: string;
  /** The reviewed message, exactly as it was submitted. */
  content: DonorThankYouContent;
  settings: ThankYouSettings;
  /** Records the publication in the transaction that queues it (PublicationApplyContext.publish). */
  publish(thankYouId: string): Promise<void>;
}

/** The publisher fence every publishing write runs in (MongoCampaignCreation). */
interface PublisherFence {
  run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T>;
}

/**
 * Post-campaign thank-you messages from the organizer or beneficiary to the
 * campaign's donors. Recipients are resolved and emailed by the server: the
 * author sees counts, never who received the message or their addresses.
 *
 * Delivery follows the activity-alert pattern: deterministic per-recipient
 * rows (a retry can never add a second), leases (two API instances never work
 * the same row), the exact request saved before sending and the provider
 * idempotency key, so a crash mid-send cannot produce a duplicate email.
 */
export class MongoDonorThankYous {
  private readonly unsubscribeKey: Buffer | null;
  private readonly fence: PublisherFence;

  constructor(private readonly deps: {
    sender: ActivityEmailSender;
    accountEmailKey: Buffer | null;
    apiUrl: string;
    config: { resolveThankYouConfig(): Promise<ThankYouSettings> };
    admission?: PublicationAdmissionPort;
    /** The publisher fence a message is queued in (default MongoCampaignCreation). */
    fence?: PublisherFence;
  }) {
    this.unsubscribeKey = deps.accountEmailKey?.length === 32
      ? Buffer.from(hkdfSync('sha256', deps.accountEmailKey, Buffer.alloc(0), 'ujimora-donor-message-unsubscribe-v1', 32))
      : null;
    this.fence = deps.fence ?? new MongoCampaignCreation();
  }

  /** Sending needs the provider, a signing key for unsubscribe links and an https site to link to. */
  get configured(): boolean {
    let secure = false;
    try { secure = new URL(this.deps.sender.webUrl).protocol === 'https:'; } catch { /* unavailable */ }
    return this.deps.sender.configured && !!this.unsubscribeKey && secure;
  }

  // ── Unsubscribe tokens ───────────────────────────────────────────────────
  unsubscribeToken(emailHash: string): string {
    if (!this.unsubscribeKey) throw new Error('Unsubscribe signing key unavailable');
    const sig = createHmac('sha256', this.unsubscribeKey).update(`donor-thank-you-unsubscribe:${emailHash}`).digest('base64url');
    return `${emailHash}.${sig}`;
  }

  private verifyUnsubscribeToken(token: string): string {
    const [emailHash, sig] = String(token ?? '').split('.');
    if (!this.unsubscribeKey || !/^[a-f0-9]{64}$/.test(emailHash ?? '') || !sig) throw new AppError('This unsubscribe link is not valid.', 400);
    const expected = Buffer.from(this.unsubscribeToken(emailHash).split('.')[1]);
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new AppError('This unsubscribe link is not valid.', 400);
    return emailHash;
  }

  async unsubscribe(token: string): Promise<void> {
    const emailHash = this.verifyUnsubscribeToken(token);
    await DonorMessageSuppressionModel.updateOne({ _id: emailHash }, { $setOnInsert: { source: 'unsubscribe_link' } }, { upsert: true });
    logger.info({ event: 'donor_thank_you.unsubscribed' }, 'donor message unsubscribe');
  }

  async preferences(userId: string): Promise<{ thankYouEmails: boolean }> {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).select('email').lean();
    if (!user) throw new AppError('Account not found', 404);
    return { thankYouEmails: !(await DonorMessageSuppressionModel.exists({ _id: sha256(normalizeEmail(user.email)) })) };
  }

  async setPreferences(userId: string, thankYouEmails: boolean): Promise<{ thankYouEmails: boolean }> {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).select('email').lean();
    if (!user) throw new AppError('Account not found', 404);
    const emailHash = sha256(normalizeEmail(user.email));
    if (thankYouEmails) await DonorMessageSuppressionModel.deleteOne({ _id: emailHash });
    else await DonorMessageSuppressionModel.updateOne({ _id: emailHash }, { $setOnInsert: { source: 'settings' } }, { upsert: true });
    return { thankYouEmails };
  }

  // ── Authoring ────────────────────────────────────────────────────────────
  private async authorize(campaignId: string, userId: string): Promise<{ campaign: CampaignDocument; role: 'manager' | 'beneficiary' }> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
    if (!campaign) throw new AppError('Campaign not found', 404);
    if (await campaignManagerRole(campaign, userId)) return { campaign, role: 'manager' };
    const onBehalf = campaign.onBehalf;
    if (campaign.creationMode === 'on_behalf' && onBehalf?.beneficiaryUserId === userId && onBehalf.consentStatus === 'accepted') return { campaign, role: 'beneficiary' };
    throw new AppError('Campaign not found', 404);
  }

  /** Distinct donors right now. The exact list is resolved (and re-checked) when sending. */
  private async estimateRecipients(campaignId: string): Promise<number> {
    const [row] = await DonationIntentModel.aggregate<{ count: number }>([
      { $match: { campaignId, status: { $in: ELIGIBLE_STATUSES }, $or: [{ donorUserId: { $type: 'string' } }, { donorEmail: { $type: 'string', $ne: '' } }] } },
      { $group: { _id: { $cond: [{ $eq: [{ $type: '$donorUserId' }, 'string'] }, { $concat: ['user:', '$donorUserId'] }, { $concat: ['email:', { $toLower: { $trim: { input: '$donorEmail' } } }] }] } } },
      { $count: 'count' },
    ]);
    return row?.count ?? 0;
  }

  private async eligibility(campaign: CampaignDocument, settings: ThankYouSettings): Promise<Omit<DonorThankYouState, 'draft' | 'history'>> {
    const campaignId = campaign._id.toString();
    const sendsUsed = await DonorThankYouModel.countDocuments({ campaignId, sendSlot: { $type: 'number' } });
    const base = { sendsUsed, sendsAllowed: settings.maxSendsPerCampaign, estimatedRecipients: 0 };
    if (!settings.enabled) return { ...base, eligible: false, reason: 'disabled' };
    if (campaign.status === CampaignStatus.BLOCKED) return { ...base, eligible: false, reason: 'campaign_unavailable' };
    const ended = campaign.status === CampaignStatus.EXPIRED || campaign.endDate <= new Date();
    const trigger = settings.afterCampaignEnd && ended ? 'campaign_ended' as const
      : settings.afterPayoutPaid && await PayoutModel.exists({ campaignId, status: 'PAID' }) ? 'payout_paid' as const : undefined;
    const estimatedRecipients = await this.estimateRecipients(campaignId);
    const result = { ...base, estimatedRecipients, trigger };
    if (!trigger) return { ...result, eligible: false, reason: 'not_ended' };
    if (sendsUsed >= settings.maxSendsPerCampaign) return { ...result, eligible: false, reason: 'limit_reached' };
    if (estimatedRecipients === 0) return { ...result, eligible: false, reason: 'no_donors' };
    if (!this.configured) return { ...result, eligible: false, reason: 'email_unavailable' };
    return { ...result, eligible: true };
  }

  async state(campaignId: string, actor: Actor): Promise<DonorThankYouState> {
    const { campaign } = await this.authorize(campaignId, actor.userId);
    const settings = await this.deps.config.resolveThankYouConfig();
    const [eligibility, draft, history] = await Promise.all([
      this.eligibility(campaign, settings),
      DonorThankYouModel.findOne({ campaignId, status: 'draft' }),
      DonorThankYouModel.find({ campaignId, status: { $ne: 'draft' } }).sort({ submittedAt: -1 }).limit(20),
    ]);
    return { ...eligibility, draft: draft ? toView(draft) : undefined, history: history.map(toView) };
  }

  async saveDraft(campaignId: string, actor: Actor, content: DonorThankYouContent): Promise<DonorThankYouView> {
    const { role } = await this.authorize(campaignId, actor.userId);
    const clean = cleanContent(content);
    try {
      const doc = await DonorThankYouModel.findOneAndUpdate({ campaignId, status: 'draft' },
        { $set: { ...clean, authorId: actor.userId, authorRole: role }, $setOnInsert: { campaignId, status: 'draft' } },
        { new: true, upsert: true });
      logger.info({ event: 'donor_thank_you.draft_saved', campaignId, role }, 'donor thank-you draft saved');
      return toView(doc!);
    } catch (error) {
      // Two first saves raced on the one-draft index: the other one won, update it.
      if ((error as { code?: number }).code !== 11000) throw error;
      const doc = await DonorThankYouModel.findOneAndUpdate({ campaignId, status: 'draft' }, { $set: { ...clean, authorId: actor.userId, authorRole: role } }, { new: true });
      if (!doc) throw new AppError('Your draft changed. Reload and try again.', 409);
      return toView(doc);
    }
  }

  async discardDraft(campaignId: string, actor: Actor): Promise<void> {
    await this.authorize(campaignId, actor.userId);
    await DonorThankYouModel.deleteOne({ campaignId, status: 'draft' });
  }

  private async context(campaign: CampaignDocument) {
    return {
      title: campaign.title, onBehalf: campaign.creationMode === 'on_behalf' ? campaign.onBehalf : undefined,
      organizer: await organizerName(campaign.creatorId),
      url: `${this.deps.sender.webUrl}${campaign.slug ? `/c/${campaign.slug}` : `/campaigns/${campaign._id.toString()}`}`,
    };
  }

  /** The one renderer: previews and real sends produce the same email. */
  private render(content: DonorThankYouContent, ctx: Awaited<ReturnType<MongoDonorThankYous['context']>>, unsubscribeUrl: string): DonorThankYouPreview {
    const title = oneLine(ctx.title);
    const who = ctx.onBehalf ? ` It was run by ${oneLine(ctx.organizer)} for ${oneLine(ctx.onBehalf.beneficiaryName)}.` : '';
    const email = renderEmail({
      preheader: oneLine(content.body).slice(0, 140),
      eyebrow: 'Thank you for giving',
      heading: content.subject,
      details: [{ label: 'Campaign', value: title }],
      message: { body: content.body, signature: content.signature || undefined },
      button: { label: 'See the campaign', url: ctx.url },
      footer: [`You are receiving this because you gave to “${title}” on Ujimora.${who} Ujimora sent this message for the campaign; your email address was not shared with them.`],
      footerLinks: [{ label: 'Stop thank-you messages from campaigns', url: unsubscribeUrl }],
    }, { webUrl: this.deps.sender.webUrl, supportEmail: this.deps.sender.replyTo });
    return { subject: content.subject, text: email.text, html: email.html };
  }

  async preview(campaignId: string, actor: Actor, content: DonorThankYouContent): Promise<DonorThankYouPreview> {
    const { campaign } = await this.authorize(campaignId, actor.userId);
    return this.render(cleanContent(content), await this.context(campaign), `${this.deps.sender.webUrl}/unsubscribe/thank-you#token=…`);
  }

  /**
   * The publishing checks of the sender's own request, before anything is
   * held for review, as the content-acceptance middleware applies them to the
   * other publishing routes: an open account, the current agreement (staff
   * excepted), and no publishing restriction on the sender or on the
   * campaign's organizer. The queueing transaction repeats them as fences.
   */
  private async assertMayPublish(campaign: CampaignDocument, userId: string): Promise<void> {
    const user = await UserModel.findOne({ _id: userId, deletedAt: null }).select('role legalAcceptance').lean();
    if (!user) throw new AppError('Account authorization changed. Sign in again.', 401, undefined, 'account_session');
    if (user.role !== 'admin' && !hasCurrentLegalAcceptance(user.legalAcceptance)) throw new AppError('Accept the current account agreement before publishing.', 428, undefined, 'terms_required');
    if (await ContentRestrictionModel.exists({ userId })) throw actorRestricted();
    if (campaign.creatorId !== userId && await ContentRestrictionModel.exists({ userId: campaign.creatorId })) throw ownerRestricted();
  }

  /**
   * Who the sender is to the campaign now, inside the queueing transaction:
   * its owner, an active admin or editor of the open organization that runs
   * it, or its beneficiary with accepted consent. The membership and the
   * organization are written (as MongoCampaignContentWrite does), so a
   * revocation or closure conflicts with the send instead of reading around
   * it; the beneficiary's consent lives on the campaign, which the caller has
   * already written.
   */
  private async currentRole(campaign: CampaignDocument, userId: string): Promise<ThankYouRole | null> {
    if (campaign.creatorId === userId) return 'manager';
    const member = await OrganizationMemberModel.updateOne(
      { organizationId: campaign.creatorId, userId, status: 'active', role: { $in: ['admin', 'editor'] } },
      { $inc: { profileWriteVersion: 1 } }, { timestamps: false });
    if (member.matchedCount) {
      const organization = await UserModel.updateOne({ _id: campaign.creatorId, role: 'organization', deletedAt: null }, { $inc: { publicationWriteVersion: 1 } }, { timestamps: false });
      if (organization.matchedCount) return 'manager';
    }
    const onBehalf = campaign.onBehalf;
    if (campaign.creationMode === 'on_behalf' && onBehalf?.beneficiaryUserId === userId && onBehalf.consentStatus === 'accepted') return 'beneficiary';
    return null;
  }

  /**
   * Queues the campaign's draft as its next thank-you message, once. Call it
   * inside the publisher fence for the sender (MongoCampaignCreation.run:
   * their open account, credential version, agreement and restriction), as
   * `submit` and `queueApproved` do. In that transaction it re-checks the
   * campaign (not deleted; written, so a block, closure or consent change
   * conflicts with the send), the sender's role, a publishing restriction on
   * the campaign's organizer, eligibility (email that is not configured yet
   * aside: queued messages wait for it, nothing is lost), that the draft
   * still holds exactly this message, and the send limit; then moves the
   * draft to `queued` with the next send slot (unique per campaign) and
   * audits it. The worker (`process`) resolves the recipients and emails them
   * later, skipping donors who were refunded or unsubscribed by then and
   * accounts that are closed or unverified. Refusals are AppErrors with a
   * code (REASON_CODES, or a publication fence code).
   */
  async queueInTransaction(request: ThankYouQueueRequest): Promise<QueuedThankYou> {
    const { actorId, campaignId, content } = request;
    if (!isValidObjectId(campaignId)) throw campaignGone();
    const campaign = await CampaignModel.findOneAndUpdate({ _id: campaignId, deletedAt: { $exists: false } },
      { $inc: { commentCreationWriteVersion: 1 } }, { new: true, timestamps: false });
    if (!campaign) throw campaignGone();
    const role = await this.currentRole(campaign, actorId);
    if (!role) throw roleChanged();
    if (campaign.creatorId !== actorId && await ContentRestrictionModel.exists({ userId: campaign.creatorId })) throw ownerRestricted();
    const check = await this.eligibility(campaign, request.settings);
    if (!check.eligible && check.reason !== 'email_unavailable') throw blocked(check.reason!);
    const draft = await DonorThankYouModel.findOne({ campaignId, status: 'draft', ...(request.draftId ? { _id: request.draftId } : {}) });
    if (!draft || !sameContent(draft, content)) throw draftChanged();
    // Counted in this transaction; the send slot's unique index backs the limit.
    const queued = await DonorThankYouModel.findOneAndUpdate({ _id: draft._id, status: 'draft' }, {
      $set: { status: 'queued', sendSlot: check.sendsUsed + 1, submitIdempotencyKey: request.idempotencyKey, submittedBy: actorId, submittedAt: new Date(), authorRole: role },
    }, { new: true });
    if (!queued) throw new AppError('This message was already sent.', 409, undefined, 'stale_version');
    const onApproval = request.reviewId ? ` on the approval of publication review ${request.reviewId}` : '';
    await AuditLogModel.create({
      actorId, actorRole: role, action: 'donor_thank_you.submitted', resource: campaignId,
      details: `Thank-you message ${queued._id} queued for about ${check.estimatedRecipients} donors${onApproval}`, severity: 'info', statusCode: 202,
      ...(request.reviewId ? { method: 'INTERNAL', path: 'internal:publication.published' } : { method: 'POST', path: '/campaigns/:id/thank-you/send' }),
    });
    return { view: toView(queued), role, estimatedRecipients: check.estimatedRecipients };
  }

  async submit(campaignId: string, actor: Actor, options: { automatedReviewConsent?: boolean }, idempotencyKey: string | undefined): Promise<{ view: DonorThankYouView; replayed: boolean }> {
    if (!idempotencyKey || !/^[a-zA-Z0-9_-]{16,100}$/.test(idempotencyKey)) throw new AppError('An Idempotency-Key header of 16-100 letters, digits, hyphens or underscores is required.', 400);
    const { campaign } = await this.authorize(campaignId, actor.userId);
    const replay = await DonorThankYouModel.findOne({ campaignId, submitIdempotencyKey: idempotencyKey });
    if (replay) return { view: toView(replay), replayed: true };
    await this.assertMayPublish(campaign, actor.userId);
    const settings = await this.deps.config.resolveThankYouConfig();
    const check = await this.eligibility(campaign, settings);
    if (!check.eligible) throw blocked(check.reason!);
    const draft = await DonorThankYouModel.findOne({ campaignId, status: 'draft' });
    if (!draft) throw new AppError('Save your message before sending it.', 409);
    const admission = this.deps.admission;
    if (!admission?.assertCurrent) throw new AppError('Message safety review is unavailable.', 503);
    // Donor-facing text goes through the same safety review as public content.
    const content: DonorThankYouContent = { subject: draft.subject, body: draft.body, signature: draft.signature };
    const submission: PublicationSubmission = {
      actorId: actor.userId, action: 'thank_you.send', resourceId: campaignId, mediaUrls: [],
      text: JSON.stringify(content), automatedReviewConsent: options.automatedReviewConsent, authVersion: actor.authVersion,
    };
    await admission.assertAllowed(submission);
    // Queued under the draft's id: the message is the draft, moved to `queued`.
    const draftId = draft._id.toString();
    try {
      const queued = await this.fence.run(actor.userId, actor.authVersion ?? '', async () => {
        // Approvals are single-use: consumed first, so a version its approval published meanwhile is refused as published.
        await admission.assertCurrent!(submission, { publishedResourceId: draftId });
        return this.queueInTransaction({ actorId: actor.userId, campaignId, content, draftId, idempotencyKey, settings });
      });
      logger.info({ event: 'donor_thank_you.send_requested', campaignId, thankYouId: queued.view.id, estimatedRecipients: queued.estimatedRecipients, role: queued.role }, 'donor thank-you queued');
      return { view: queued.view, replayed: false };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const winner = await DonorThankYouModel.findOne({ campaignId, submitIdempotencyKey: idempotencyKey });
        if (winner) return { view: toView(winner), replayed: true };
        throw blocked('limit_reached');
      }
      throw error;
    }
  }

  /**
   * Publishing on approval: queues the approved message as if its author had
   * pressed Send at this moment, through the same fence and checks as
   * `submit` (queueInTransaction), under the key
   * `publication-review-<reviewId>`, and records the publication in the same
   * transaction. Emails go out once: this only queues; the draft's
   * compare-and-set, the unique send slot and the publication's own
   * compare-and-set refuse a second queueing.
   */
  async queueApproved(approved: ApprovedThankYou): Promise<QueuedThankYou> {
    const queued = await this.fence.run(approved.actorId, approved.authVersion, async () => {
      const result = await this.queueInTransaction({
        actorId: approved.actorId, campaignId: approved.campaignId, content: approved.content,
        idempotencyKey: `publication-review-${approved.reviewId}`, settings: approved.settings, reviewId: approved.reviewId,
      });
      await approved.publish(result.view.id);
      return result;
    });
    logger.info({
      event: 'donor_thank_you.send_requested', campaignId: approved.campaignId, thankYouId: queued.view.id, reviewId: approved.reviewId,
      estimatedRecipients: queued.estimatedRecipients, role: queued.role,
    }, 'donor thank-you queued on its approval');
    return queued;
  }

  async summary(campaignId: string, thankYouId: string, actor: Actor): Promise<DonorThankYouView> {
    await this.authorize(campaignId, actor.userId);
    if (!isValidObjectId(thankYouId)) throw new AppError('Message not found', 404);
    const doc = await DonorThankYouModel.findOne({ _id: thankYouId, campaignId });
    if (!doc) throw new AppError('Message not found', 404);
    return toView(doc);
  }

  /** Re-queues only failures that can be retried safely. Sent rows are never touched. */
  private async requeueFailures(thankYouId: string): Promise<number> {
    const now = Date.now();
    const rows = await DonorThankYouDeliveryModel.find({ thankYouId, status: 'failed', retryable: true }).select('_id firstAttemptAt lastErrorCode');
    let requeued = 0;
    for (const row of rows) {
      // Inside the provider's idempotency window the same key is reused (safe even
      // if an earlier attempt got through). Past it, only a definite refusal (the
      // provider answered with an error) may be sent under a fresh key: a timeout
      // might have been delivered, and resending it could duplicate the email.
      const fresh = !row.firstAttemptAt || now - row.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS;
      if (fresh && row.firstAttemptAt && !row.lastErrorCode?.startsWith('http_')) {
        await DonorThankYouDeliveryModel.updateOne({ _id: row._id, status: 'failed' }, { $set: { retryable: false, lastErrorCode: 'uncertain_delivery', lastErrorMessage: 'The provider did not confirm this delivery in time.' }, $unset: { emailRequest: 1 } });
        continue;
      }
      requeued++;
      await DonorThankYouDeliveryModel.updateOne({ _id: row._id, status: 'failed', retryable: true }, {
        $set: { status: 'pending', nextAttemptAt: new Date(), attempts: 0 },
        $unset: { failedAt: 1, lastErrorCode: 1, lastErrorMessage: 1, retryable: 1, leaseToken: 1, leaseUntil: 1, ...(fresh ? { firstAttemptAt: 1, emailRequest: 1 } : {}) },
        ...(fresh ? { $inc: { retryGeneration: 1 } } : {}),
      });
    }
    if (requeued) await DonorThankYouModel.updateOne({ _id: thankYouId, status: { $in: ['partially_sent', 'failed'] } }, { $set: { status: 'sending' }, $unset: { completedAt: 1 } });
    return requeued;
  }

  async retry(campaignId: string, thankYouId: string, actor: Actor): Promise<{ requeued: number }> {
    const { role } = await this.authorize(campaignId, actor.userId);
    if (!isValidObjectId(thankYouId) || !(await DonorThankYouModel.exists({ _id: thankYouId, campaignId, status: { $in: ['partially_sent', 'failed'] } })))
      throw new AppError('Only a message with failed deliveries can be retried.', 409);
    const requeued = await this.requeueFailures(thankYouId);
    if (!requeued) throw new AppError('No failed deliveries can be retried.', 409);
    await AuditLogModel.create({ actorId: actor.userId, actorRole: role, action: 'donor_thank_you.retried', resource: campaignId, details: `Retried ${requeued} failed deliveries of ${thankYouId}`, severity: 'info', method: 'POST', path: '/campaigns/:id/thank-you/:thankYouId/retry', statusCode: 200 });
    return { requeued };
  }

  // ── Staff ────────────────────────────────────────────────────────────────
  async adminList(query: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1), pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const filter = { status: query.status && query.status !== 'all' ? query.status : { $ne: 'draft' } };
    const [items, total] = await Promise.all([
      DonorThankYouModel.find(filter).sort({ submittedAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
      DonorThankYouModel.countDocuments(filter),
    ]);
    const campaigns = await CampaignModel.find({ _id: { $in: items.map(item => item.campaignId).filter(isValidObjectId) } }).select('title').lean();
    const titles = new Map(campaigns.map(c => [c._id.toString(), c.title]));
    // Counts and message text only: no recipient identities or addresses.
    return { items: items.map(item => ({ ...toView(item), campaignTitle: titles.get(item.campaignId) ?? 'Deleted campaign' })), total, page, pageSize };
  }

  async adminRetry(thankYouId: string, adminId: string): Promise<{ requeued: number }> {
    if (!isValidObjectId(thankYouId)) throw new AppError('Message not found', 404);
    const doc = await DonorThankYouModel.findById(thankYouId);
    if (!doc || !['partially_sent', 'failed'].includes(doc.status)) throw new AppError('Only a message with failed deliveries can be retried.', 409);
    const requeued = await this.requeueFailures(thankYouId);
    await AuditLogModel.create({ actorId: adminId, actorRole: 'admin', action: 'donor_thank_you.retried', resource: doc.campaignId, details: `Staff retried ${requeued} failed deliveries of ${thankYouId}`, severity: 'info', method: 'POST', path: '/admin/donor-thank-yous/:id/retry', statusCode: 200 });
    return { requeued };
  }

  // ── Worker ───────────────────────────────────────────────────────────────
  /** Called every 30 s by the notification loop, and directly by tests. */
  async process(): Promise<void> {
    if (!this.configured) return; // Queued messages wait; nothing is lost.
    await this.resolveQueued();
    await this.dispatch();
    await this.finalize();
  }

  /** Turns a queued message into one delivery row per distinct donor. Idempotent: re-running upserts the same rows. */
  private async resolveQueued(limit = 5): Promise<void> {
    for (let i = 0; i < limit; i++) {
      const now = new Date(), leaseToken = randomUUID();
      const job = await DonorThankYouModel.findOneAndUpdate({ status: 'queued', $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $set: { leaseToken, leaseUntil: new Date(now.getTime() + 5 * 60_000) } }, { new: true, sort: { submittedAt: 1 } });
      if (!job) return;
      try {
        const intents = await DonationIntentModel.find({ campaignId: job.campaignId, status: { $in: ELIGIBLE_STATUSES } }).select('_id donorUserId donorEmail').lean();
        const recipients = new Map<string, { userId?: string; emailHash?: string; intentIds: string[] }>();
        for (const intent of intents) {
          const userId = typeof intent.donorUserId === 'string' && intent.donorUserId ? intent.donorUserId : undefined;
          const email = typeof intent.donorEmail === 'string' ? normalizeEmail(intent.donorEmail) : '';
          const key = userId ? `user:${userId}` : email ? `email:${sha256(email)}` : '';
          if (!key) continue;
          const entry = recipients.get(key) ?? { userId, emailHash: userId ? undefined : sha256(email), intentIds: [] };
          entry.intentIds.push(intent._id.toString());
          recipients.set(key, entry);
        }
        // A guest gift from an address that belongs to a donor's account is the same person: one message.
        const userIds = [...recipients.values()].flatMap(r => r.userId ? [r.userId] : []);
        const users = userIds.length ? await UserModel.find({ _id: { $in: userIds.filter(isValidObjectId) } }).select('email').lean() : [];
        for (const user of users) {
          const guestKey = `email:${sha256(normalizeEmail(user.email))}`;
          const guest = recipients.get(guestKey);
          if (!guest) continue;
          recipients.get(`user:${user._id.toString()}`)!.intentIds.push(...guest.intentIds);
          recipients.delete(guestKey);
        }
        const thankYouId = job._id.toString();
        const entries = [...recipients.entries()];
        for (let start = 0; start < entries.length; start += 500) {
          await DonorThankYouDeliveryModel.bulkWrite(entries.slice(start, start + 500).map(([recipientKey, r]) => ({
            updateOne: {
              filter: { _id: sha256(`${thankYouId}:${recipientKey}:email`) },
              update: {
                $setOnInsert: { thankYouId, campaignId: job.campaignId, recipientKey, recipientUserId: r.userId, emailHash: r.emailHash, channel: 'email' as const, status: 'pending' as const, attempts: 0, retryGeneration: 0, nextAttemptAt: new Date() },
                $addToSet: { intentIds: { $each: r.intentIds } },
              },
              upsert: true,
            },
          })), { ordered: false });
        }
        const recipientCount = await DonorThankYouDeliveryModel.countDocuments({ thankYouId });
        await DonorThankYouModel.updateOne({ _id: job._id, leaseToken }, { $set: { status: 'sending', recipientCount, recipientsResolvedAt: new Date() }, $unset: { leaseToken: 1, leaseUntil: 1 } });
        logger.info({ event: 'donor_thank_you.recipients_resolved', thankYouId, recipientCount }, 'donor thank-you recipients resolved');
      } catch (error) {
        logger.warn({ err: error, thankYouId: job._id }, 'donor thank-you recipient resolution failed; will retry');
        await DonorThankYouModel.updateOne({ _id: job._id, leaseToken }, { $unset: { leaseToken: 1, leaseUntil: 1 } });
      }
    }
  }

  private async dispatch(limit = 100): Promise<void> {
    const cache = new Map<string, { doc: DonorThankYouDocument; ctx: Awaited<ReturnType<MongoDonorThankYous['context']>> } | null>();
    for (let index = 0; index < limit; index++) {
      const now = new Date(), leaseToken = randomUUID();
      const row = await DonorThankYouDeliveryModel.findOneAndUpdate(
        { status: 'pending', nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }] },
        { $set: { leaseToken, leaseUntil: new Date(now.getTime() + 60_000) } },
        { new: true, sort: { nextAttemptAt: 1 } },
      ).select('+emailRequest');
      if (!row) return;
      const match = { _id: row._id, status: 'pending', leaseToken };
      const release = { leaseToken: 1, leaseUntil: 1 } as const;
      try {
        if (!cache.has(row.thankYouId)) {
          const doc = await DonorThankYouModel.findById(row.thankYouId);
          const campaign = doc ? await CampaignModel.findById(doc.campaignId) : null;
          cache.set(row.thankYouId, doc && campaign ? { doc, ctx: await this.context(campaign) } : null);
        }
        const job = cache.get(row.thankYouId);
        if (!job) { await this.skip(match, 'no_contact', release); continue; }
        // A refund or dispute after the message was queued removes the donor.
        if (!(await DonationIntentModel.exists({ _id: { $in: row.intentIds }, status: { $in: ELIGIBLE_STATUSES } }))) { await this.skip(match, 'donation_refunded', release); continue; }
        const address = await this.addressFor(row);
        if (!address) { await this.skip(match, 'no_contact', release); continue; }
        const emailHash = sha256(address);
        if (await DonorMessageSuppressionModel.exists({ _id: emailHash })) { await this.skip(match, 'unsubscribed', release); continue; }
        if (row.emailRequest) {
          const to = (row.emailRequest as { to?: unknown }).to;
          if (!Array.isArray(to) || to.length !== 1 || normalizeEmail(String(to[0])) !== address) { await this.skip(match, 'no_contact', release); continue; }
        }
        if (row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS) {
          await DonorThankYouDeliveryModel.updateOne(match, { $set: { status: 'failed', failedAt: new Date(), retryable: false, lastErrorCode: 'uncertain_delivery', lastErrorMessage: 'The provider did not confirm this delivery in time.' }, $unset: { ...release, emailRequest: 1 } });
          continue;
        }
        const token = this.unsubscribeToken(emailHash);
        const rendered = this.render(job.doc, job.ctx, `${this.deps.sender.webUrl}/unsubscribe/thank-you#token=${token}`);
        const payload = row.emailRequest ?? {
          from: this.deps.sender.from, reply_to: this.deps.sender.replyTo, to: [address], subject: rendered.subject, text: rendered.text, html: rendered.html,
          headers: { 'List-Unsubscribe': `<${this.deps.apiUrl}/api/v1/donor-messages/unsubscribe?token=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        };
        await DonorThankYouDeliveryModel.updateOne(match, { $set: { emailRequest: payload, firstAttemptAt: row.firstAttemptAt ?? new Date() }, $inc: { attempts: 1 } });
        const result = await this.deps.sender.send(`thank-you/${row._id}/g${row.retryGeneration}`, payload);
        const providerMessageId = result && typeof result === 'object' && 'id' in result ? result.id : undefined;
        await DonorThankYouDeliveryModel.updateOne(match, { $set: { status: 'sent', sentAt: new Date(), ...(providerMessageId ? { providerMessageId } : {}) }, $unset: { ...release, emailRequest: 1, lastErrorCode: 1, lastErrorMessage: 1, retryable: 1 } });
      } catch (error) {
        await this.recordFailure(row, match, error);
      }
    }
  }

  private async addressFor(row: DonorThankYouDeliveryDocument): Promise<string | null> {
    if (row.recipientUserId) {
      if (!isValidObjectId(row.recipientUserId)) return null;
      const user = await UserModel.findOne({ _id: row.recipientUserId, deletedAt: null }).select('email emailVerified').lean();
      return user?.emailVerified && user.email ? normalizeEmail(user.email) : null;
    }
    const intents = await DonationIntentModel.find({ _id: { $in: row.intentIds } }).select('donorEmail').lean();
    for (const intent of intents) {
      if (typeof intent.donorEmail === 'string' && sha256(normalizeEmail(intent.donorEmail)) === row.emailHash) return normalizeEmail(intent.donorEmail);
    }
    return null;
  }

  private async skip(match: object, reason: 'donation_refunded' | 'unsubscribed' | 'no_contact', release: object): Promise<void> {
    await DonorThankYouDeliveryModel.updateOne(match, { $set: { status: 'skipped', skipReason: reason }, $unset: { ...release, emailRequest: 1 } });
  }

  private async recordFailure(row: DonorThankYouDeliveryDocument, match: object, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const refused = error instanceof EmailDeliveryError;
    // A refusal with a response was never accepted; a timeout or network error may have been.
    const temporary = refused ? error.retryable : true;
    const code = refused ? `http_${error.status}` : 'network';
    const message = refused ? `Email provider responded ${error.status}.` : 'Could not reach the email provider.';
    // A retry under the same idempotency key must send the same request, so the
    // saved request stays while the row can be retried and goes when it cannot.
    if (temporary && attempts < MAX_AUTOMATIC_ATTEMPTS) {
      const wait = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] * 60_000;
      await DonorThankYouDeliveryModel.updateOne(match, { $set: { nextAttemptAt: new Date(Date.now() + wait), lastErrorCode: code, lastErrorMessage: message }, $unset: { leaseToken: 1, leaseUntil: 1 } });
      return;
    }
    await DonorThankYouDeliveryModel.updateOne(match, {
      $set: { status: 'failed', failedAt: new Date(), lastErrorCode: code, lastErrorMessage: message, retryable: temporary },
      $unset: { leaseToken: 1, leaseUntil: 1, ...(temporary ? {} : { emailRequest: 1 }) },
    });
    logger.warn({ event: 'donor_thank_you.delivery_failed', thankYouId: row.thankYouId, code, attempts }, 'donor thank-you delivery failed');
  }

  /** Refreshes counts on messages being sent and closes the ones with nothing left to do. */
  private async finalize(): Promise<void> {
    const active = await DonorThankYouModel.find({ status: 'sending' }).limit(50);
    for (const job of active) {
      const thankYouId = job._id.toString();
      const counts = await DonorThankYouDeliveryModel.aggregate<{ _id: string; n: number; retryable: number }>([
        { $match: { thankYouId } },
        { $group: { _id: '$status', n: { $sum: 1 }, retryable: { $sum: { $cond: [{ $eq: ['$retryable', true] }, 1, 0] } } } },
      ]);
      const count = (status: string) => counts.find(c => c._id === status)?.n ?? 0;
      const sent = count('sent'), failed = count('failed'), skipped = count('skipped'), pending = count('pending');
      const retryable = counts.find(c => c._id === 'failed')?.retryable ?? 0;
      const tallies = { sentCount: sent, failedCount: failed, skippedCount: skipped, retryableCount: retryable, recipientCount: sent + failed + skipped + pending };
      if (pending > 0) { await DonorThankYouModel.updateOne({ _id: job._id, status: 'sending' }, { $set: tallies }); continue; }
      const status = failed === 0 ? (sent > 0 || skipped > 0 ? 'sent' : 'failed') : sent > 0 ? 'partially_sent' : 'failed';
      const done = await DonorThankYouModel.findOneAndUpdate({ _id: job._id, status: 'sending' }, { $set: { ...tallies, status, completedAt: new Date() } }, { new: true });
      if (!done) continue;
      logger.info({ event: 'donor_thank_you.completed', thankYouId, status, sent, failed, skipped }, 'donor thank-you finished');
      const campaign = await CampaignModel.findById(job.campaignId).select('title creatorId onBehalf').lean();
      const title = campaign?.title ?? 'your campaign';
      const body = sent + failed + skipped === 0
        ? `Your thank-you for “${title}” was not sent: no donors were eligible to receive it when it was processed.`
        : status === 'sent'
          ? `Your thank-you for “${title}” reached ${sent} ${sent === 1 ? 'donor' : 'donors'}.${skipped ? ` ${skipped} had opted out or were no longer eligible.` : ''}`
          : `Your thank-you for “${title}” reached ${sent} of ${sent + failed} donors. ${retryable ? 'You can retry the failed deliveries from the campaign page.' : 'Some deliveries could not be completed.'}`;
      await recordAccountNotice({ key: `thank-you:done:${thankYouId}:${done.completedAt?.getTime()}`, userId: job.submittedBy, type: 'donor_thank_you',
        title: status === 'sent' ? 'Your thank-you was delivered' : 'Some thank-you messages were not delivered', body, path: `/campaigns/${job.campaignId}/thank-you` });
    }
  }
}
