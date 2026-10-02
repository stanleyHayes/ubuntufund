import { createHash, randomBytes } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  BENEFICIARY_CONSENT_VERSION,
  CampaignStatus,
  isContentCheckOutstanding,
  type BeneficiaryCampaignListItem,
  type BeneficiaryInvitationPreview,
  type BeneficiaryPartyType,
  type BeneficiaryRelationship,
  type CampaignBeneficiaryDetails,
  type ChangeBeneficiaryResult,
  type OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types';
import { CampaignModel, type CampaignDocument } from '../../../database/models/CampaignModel.js';
import { CampaignBeneficiaryInvitationModel, WITHDRAWN_UNSENT } from '../../../database/models/CampaignBeneficiaryInvitationModel.js';
import { CampaignBeneficiaryConsentEventModel, type BeneficiaryConsentEventType } from '../../../database/models/CampaignBeneficiaryConsentEventModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { campaignManagerRole, organizerName, recordAccountNotice } from './campaignManagers.js';
import { awaitsBeneficiary, consentPublishes, nextStepOf, staffAreNext } from './onBehalfPublication.js';
import { payoutAuthorityOf } from '../../../../domain/services/campaignPayoutAuthority.js';
import { campaignCreationSubmission, storedCampaignVersion } from '../../../../domain/services/campaignCreationSubmission.js';
import { publicationFingerprint } from '../../../../domain/services/publicationFingerprint.js';
import type { CampaignAdmission, PublicationAdmissionPort, PublicationSubmission } from '../../../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { ReviewQueueAlertPort, ReviewQueueOccasion } from '../../../../domain/ports/outbound/ReviewQueueAlertPort.js';
import { logger } from '../../../logging/logger.js';
import type { OnBehalfSettings } from '../../../../application/services/CommercialConfigService.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const INVALID_LINK = 'This invitation link is not valid. Ask the organizer to send a new one.';
const RESEND_COOLDOWN_MS = 60_000;
const HELD_FOR_CONTENT_CHECK = 'The invitation is sent once our team has checked the campaign. There is nothing to send yet.';
/** On a change or reassignment recorded while its invitation waits: why nothing was sent yet. */
const HELD_NOTE = 'The invitation waits for our team to check the campaign.';
const RELEASED_NOTE = 'Sent after the content check was cleared';

/** How a beneficiary change was admitted, as its consent event records it. */
type ChangeAdmission = 'screening' | 'prior_approval' | 'staff_review';

export interface InvitationEmailPort {
  configured: boolean;
  enqueueBeneficiaryInvitation(input: {
    invitationId: string; email: string; token: string; expiresAt: Date;
    organizerName: string; campaignTitle: string; beneficiaryName: string;
    payoutArrangement: OnBehalfPayoutArrangement; publicationRequiresConsent: boolean;
  }): Promise<void>;
}

export interface RequestMeta { ip?: string; userAgent?: string }

export interface BeneficiaryInput {
  beneficiaryType: BeneficiaryPartyType;
  beneficiaryName: string;
  beneficiaryEmail: string;
  relationship: BeneficiaryRelationship;
  reason: string;
  payoutArrangement: OnBehalfPayoutArrangement;
}

/** The organizer's change: the new beneficiary, and permission to screen the campaign's public text. */
export interface BeneficiaryChangeInput extends BeneficiaryInput {
  automatedReviewConsent?: boolean;
}

/** Optional collaborators: admitting a changed beneficiary, and telling staff a campaign waits for them. */
export interface OnBehalfCampaignsDeps {
  /** Required to change a beneficiary outside a content check (fails closed without it). */
  admission?: Pick<PublicationAdmissionPort, 'admitCampaign' | 'commitCampaign'>;
  alerts?: ReviewQueueAlertPort;
}

/**
 * The campaign's public version with `beneficiary` in place of the current
 * one, as a new campaign would submit it (stored values: names trimmed, the
 * goal as saved), so its fingerprint is the one a decline of it binds.
 */
function changedVersion(campaign: CampaignDocument, beneficiary: BeneficiaryChangeInput): PublicationSubmission {
  return campaignCreationSubmission({
    ...storedCampaignVersion({
      title: campaign.title, description: campaign.description, category: campaign.category, priority: campaign.priority,
      beneficiaries: campaign.beneficiaries ?? [], goalAmount: campaign.goalAmount, currency: campaign.currency,
      endDate: campaign.endDate, imageUrls: campaign.imageUrls ?? [],
      onBehalf: { beneficiaryName: beneficiary.beneficiaryName.trim(), beneficiaryType: beneficiary.beneficiaryType,
        relationship: beneficiary.relationship, reason: beneficiary.reason.trim(), payoutArrangement: beneficiary.payoutArrangement },
    }),
    automatedReviewConsent: beneficiary.automatedReviewConsent === true,
  }, campaign.creatorId);
}

function maskEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const [local, domain] = email.split('@');
  if (!local || !domain) return undefined;
  return `${local[0]}•••@${domain}`;
}

/** Hash of the terms a beneficiary saw when deciding, recorded with the decision. */
function termsHash(campaign: CampaignDocument): string {
  return sha256(JSON.stringify({
    id: campaign._id.toString(), title: campaign.title, description: campaign.description,
    goalAmount: campaign.goalAmount, currency: campaign.currency, endDate: campaign.endDate.toISOString(),
    beneficiaryName: campaign.onBehalf?.beneficiaryName, beneficiaryType: campaign.onBehalf?.beneficiaryType,
    payoutArrangement: campaign.onBehalf?.payoutArrangement, consentVersion: BENEFICIARY_CONSENT_VERSION,
  }));
}

async function event(input: {
  campaignId: string; event: BeneficiaryConsentEventType; actorId?: string;
  actorRole: 'organizer' | 'beneficiary' | 'admin' | 'system' | 'invitee';
  invitationId?: string; payoutArrangement?: string; termsHash?: string; reason?: string; meta?: RequestMeta;
  admission?: ChangeAdmission;
}): Promise<void> {
  await CampaignBeneficiaryConsentEventModel.create({
    campaignId: input.campaignId, invitationId: input.invitationId, event: input.event, actorId: input.actorId,
    actorRole: input.actorRole, consentVersion: BENEFICIARY_CONSENT_VERSION, payoutArrangement: input.payoutArrangement,
    termsHash: input.termsHash, reason: input.reason, admission: input.admission, ip: input.meta?.ip, userAgent: input.meta?.userAgent?.slice(0, 300),
  });
}

async function audit(input: { actorId: string; actorRole: string; action: string; campaignId: string; details: string; reason?: string; severity?: 'info' | 'warning'; changes?: { field: string; before: unknown; after: unknown }[]; path: string; method?: string }): Promise<void> {
  await AuditLogModel.create({
    actorId: input.actorId, actorRole: input.actorRole, action: input.action, resource: input.campaignId,
    details: input.details, reason: input.reason, severity: input.severity ?? 'info', changes: input.changes,
    method: input.method ?? 'POST', path: input.path, statusCode: 200,
  });
}

/**
 * A held invitation that will never be sent keeps nothing: it is superseded,
 * its address removed and its address hash replaced (`WITHDRAWN_UNSENT`), so
 * nothing kept can confirm who the organizer named. The person was never
 * contacted, so they could not ask for that themselves. Used when staff reject
 * or block the content it waited for, when a newer invitation replaces it,
 * when the organizer's account is erased, and by the sweep for ended
 * campaigns. Runs inside the caller's transaction, if any.
 */
export async function dropHeldInvitations(campaignIds: string[]): Promise<number> {
  if (!campaignIds.length) return 0;
  const result = await CampaignBeneficiaryInvitationModel.updateMany({ campaignId: { $in: campaignIds }, status: 'held' },
    { $set: { status: 'superseded', decidedAt: new Date(), emailHash: WITHDRAWN_UNSENT }, $unset: { email: 1 } });
  return result.modifiedCount;
}

/**
 * Campaigns run on someone else's behalf: beneficiary invitations, consent,
 * and the controls around them. Every decision is recorded in the append-only
 * consent log and the audit log inside the same transaction as the change.
 */
export class MongoOnBehalfCampaigns {
  constructor(
    private readonly emails: InvitationEmailPort,
    private readonly config: { resolveOnBehalfConfig(): Promise<OnBehalfSettings> },
    private readonly deps: OnBehalfCampaignsDeps = {},
  ) {}

  /** After the change committed: staff now have to act on the campaign. Never throws. */
  private async alertStaff(campaign: CampaignDocument, occasion: ReviewQueueOccasion): Promise<void> {
    if (!this.deps.alerts) return;
    const campaignId = String(campaign._id);
    try {
      await this.deps.alerts.campaignPendingReview({
        campaignId, title: campaign.title, goalAmount: campaign.goalAmount, currency: campaign.currency, tier: campaign.tier ?? 0,
        ...(isContentCheckOutstanding(campaign) ? { contentReviewReason: campaign.contentReviewReason, contentReviewTrigger: campaign.contentReviewTrigger } : {}),
        occasion,
      });
    } catch (error) {
      logger.warn({ err: error, campaignId }, 'campaign review alert failed');
    }
  }

  get invitationsAvailable(): boolean {
    return this.emails.configured;
  }

  resolveConfig(): Promise<OnBehalfSettings> {
    return this.config.resolveOnBehalfConfig();
  }

  /**
   * Creates a new invitation (superseding any pending or held one) and queues
   * its email. Must run inside the transaction that creates or changes the
   * campaign, so a rollback leaves neither a dangling invitation nor an email.
   *
   * `held`: the campaign's content waits for a staff check, so nothing about
   * it may reach the invited address yet. The invitation is stored with its
   * address but no usable token and no email; `releaseHeldInvitation` sends it
   * when staff clear the content. A change or reassignment is still recorded
   * in the consent history now, with who made it; the release adds the send.
   *
   * `admission`: how a beneficiary change's new details were admitted.
   */
  async issueInvitation(input: {
    campaignId: string; campaignTitle: string; beneficiaryName: string; email: string;
    invitedBy: string; payoutArrangement: OnBehalfPayoutArrangement; publicationRequiresConsent: boolean;
    ttlHours: number; event: 'invited' | 'resent' | 'beneficiary_changed' | 'reassigned';
    actorRole: 'organizer' | 'admin'; reason?: string; organizer?: string; held?: boolean; admission?: ChangeAdmission;
  }): Promise<{ invitationId: string; expiresAt: Date }> {
    if (!this.emails.configured) throw new AppError('Beneficiary invitations are temporarily unavailable. Please try again later.', 503);
    const now = new Date();
    // One never sent keeps nothing about the person; one sent keeps its record.
    await dropHeldInvitations([input.campaignId]);
    await CampaignBeneficiaryInvitationModel.updateMany({ campaignId: input.campaignId, status: 'pending' }, { $set: { status: 'superseded', decidedAt: now } });
    // Only the newest invitation needs an address (to resend it); older ones drop theirs.
    await CampaignBeneficiaryInvitationModel.updateMany({ campaignId: input.campaignId, email: { $exists: true } }, { $unset: { email: 1 } });
    // A held invitation's token is discarded unseen: no link to it exists anywhere.
    const token = randomBytes(32).toString('hex');
    const email = normalizeEmail(input.email);
    const expiresAt = new Date(now.getTime() + input.ttlHours * 3600_000);
    const [invitation] = await CampaignBeneficiaryInvitationModel.create([{
      campaignId: input.campaignId, tokenHash: sha256(token), emailHash: sha256(email), email,
      status: input.held ? 'held' : 'pending', invitedBy: input.invitedBy, invitedByRole: input.actorRole, expiresAt, consentVersion: BENEFICIARY_CONSENT_VERSION,
    }]);
    if (input.held) {
      // The change itself happened now, by this person; only the email waits.
      if (input.event !== 'invited') await event({ campaignId: input.campaignId, event: input.event, actorId: input.invitedBy, actorRole: input.actorRole,
        invitationId: invitation._id.toString(), payoutArrangement: input.payoutArrangement, reason: input.reason ?? HELD_NOTE, admission: input.admission });
      logger.info({ event: 'on_behalf.invitation_held', campaignId: input.campaignId, kind: input.event }, 'beneficiary invitation held for the content check');
      return { invitationId: invitation._id.toString(), expiresAt };
    }
    await event({ campaignId: input.campaignId, event: input.event, actorId: input.invitedBy, actorRole: input.actorRole, invitationId: invitation._id.toString(), payoutArrangement: input.payoutArrangement, reason: input.reason, admission: input.admission });
    await this.emails.enqueueBeneficiaryInvitation({
      invitationId: invitation._id.toString(), email, token, expiresAt,
      organizerName: input.organizer ?? 'The organizer', campaignTitle: input.campaignTitle, beneficiaryName: input.beneficiaryName,
      payoutArrangement: input.payoutArrangement, publicationRequiresConsent: input.publicationRequiresConsent,
    });
    logger.info({ event: 'on_behalf.invitation_issued', campaignId: input.campaignId, kind: input.event }, 'beneficiary invitation issued');
    return { invitationId: invitation._id.toString(), expiresAt };
  }

  /**
   * Staff cleared the campaign's content: send the invitation that was held
   * for that check, to the address given, with a fresh expiry. The consent
   * history names whoever named this beneficiary (the organizer's side or
   * staff), as when it is sent straight away. Runs inside the staff
   * decision's transaction, so a rolled-back decision sends nothing. Returns
   * false when no invitation is held (for instance, its address was removed
   * when the content was declined).
   */
  async releaseHeldInvitation(campaignId: string): Promise<boolean> {
    const held = await CampaignBeneficiaryInvitationModel.findOne({ campaignId, status: 'held' }).select('+email');
    if (!held) return false;
    const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
    if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') return false;
    if (!held.email) throw new AppError('The beneficiary\'s address is no longer on file. Ask the organizer to change the beneficiary, then review again.', 409);
    const settings = await this.config.resolveOnBehalfConfig();
    // Recorded since held invitations exist; the fallback reads who the inviter is to this campaign now.
    const actorRole = held.invitedByRole ?? ((await campaignManagerRole(campaign, held.invitedBy)) ? 'organizer' : 'admin');
    await CampaignModel.updateOne({ _id: campaign._id }, { $set: { 'onBehalf.invitedAt': new Date() } });
    await this.issueInvitation({
      campaignId, campaignTitle: campaign.title, beneficiaryName: campaign.onBehalf.beneficiaryName, email: held.email,
      invitedBy: held.invitedBy, payoutArrangement: campaign.onBehalf.payoutArrangement, publicationRequiresConsent: campaign.onBehalf.publicationRequiresConsent,
      ttlHours: settings.invitationTtlHours, event: 'invited', actorRole, reason: RELEASED_NOTE,
      organizer: await organizerName(campaign.creatorId),
    });
    return true;
  }

  /**
   * Background sweep: held invitations of campaigns that ended, were deleted
   * or no longer exist can never be sent (review refuses an ended campaign),
   * so their addresses go.
   */
  async dropUnsendableHeld(): Promise<number> {
    const campaignIds = (await CampaignBeneficiaryInvitationModel.distinct('campaignId', { status: 'held' })).map(String).filter(id => isValidObjectId(id));
    if (!campaignIds.length) return 0;
    const open = await CampaignModel.find({ _id: { $in: campaignIds }, deletedAt: { $exists: false }, endDate: { $gt: new Date() } }).select('_id').lean();
    const openIds = new Set(open.map(campaign => String(campaign._id)));
    const stale = campaignIds.filter(id => !openIds.has(id));
    if (!stale.length) return 0;
    const dropped = await dropHeldInvitations(stale);
    if (dropped) logger.info({ event: 'on_behalf.held_invitations_dropped', count: dropped }, 'held beneficiary invitations of ended campaigns dropped');
    return dropped;
  }

  private async findInvitation(token: string) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AppError(INVALID_LINK, 404);
    const invitation = await CampaignBeneficiaryInvitationModel.findOne({ tokenHash: sha256(token) });
    if (!invitation) throw new AppError(INVALID_LINK, 404);
    return invitation;
  }

  /** Expiry is also swept in the background; checking here keeps a stale link honest. */
  private async expireIfDue(invitation: { _id: unknown; campaignId: string; status: string; expiresAt: Date }): Promise<boolean> {
    if (invitation.status !== 'pending' || invitation.expiresAt > new Date()) return false;
    await this.expireOne(String(invitation._id));
    return true;
  }

  async preview(token: string): Promise<BeneficiaryInvitationPreview> {
    const invitation = await this.findInvitation(token);
    // Never sent: nothing about the campaign is shown before staff check it.
    if (invitation.status === 'held') throw new AppError(INVALID_LINK, 404);
    if (await this.expireIfDue(invitation)) invitation.status = 'expired';
    const campaign = await CampaignModel.findOne({ _id: invitation.campaignId, deletedAt: { $exists: false } });
    if (!campaign?.onBehalf || isContentCheckOutstanding(campaign)) throw new AppError(INVALID_LINK, 404);
    return {
      status: invitation.status, expiresAt: invitation.expiresAt.toISOString(),
      campaignTitle: campaign.title, campaignSummary: campaign.description.slice(0, 600),
      goalAmount: campaign.goalAmount, currency: campaign.currency,
      organizerName: await organizerName(campaign.creatorId),
      beneficiaryName: campaign.onBehalf.beneficiaryName, beneficiaryType: campaign.onBehalf.beneficiaryType,
      relationship: campaign.onBehalf.relationship, reason: campaign.onBehalf.reason,
      payoutArrangement: campaign.onBehalf.payoutArrangement,
      requiredAccountType: campaign.onBehalf.beneficiaryType, consentVersion: invitation.consentVersion,
    };
  }

  async accept(token: string, actor: { userId: string; authVersion?: string }, meta: RequestMeta): Promise<{ campaignId: string; status: string }> {
    const found = await this.findInvitation(token);
    if (await this.expireIfDue(found)) throw new AppError('This invitation has expired. Ask the organizer to send a new one.', 410);
    const accepted = await new MongoUnitOfWork().run(async () => {
      const invitation = await CampaignBeneficiaryInvitationModel.findOne({ _id: found._id });
      if (!invitation || invitation.status !== 'pending') throw new AppError(invitation?.status === 'accepted' ? 'This invitation has already been accepted.' : 'This invitation is no longer active. Ask the organizer to send a new one.', 409);
      const user = await UserModel.findOneAndUpdate({ _id: actor.userId, deletedAt: null,
        ...(actor.authVersion ? { authVersion: actor.authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
      }, { $inc: { publicationWriteVersion: 1 } }, { new: true });
      if (!user) throw new AppError('Sign in again to accept this invitation.', 401);
      if (!user.emailVerified) throw new AppError('Verify your email address before accepting.', 403);
      if (sha256(normalizeEmail(user.email)) !== invitation.emailHash)
        throw new AppError('This invitation was sent to a different email address. Sign in with that address, or ask the organizer to invite the address you use.', 403);
      const campaign = await CampaignModel.findOne({ _id: invitation.campaignId, deletedAt: { $exists: false } });
      if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf' || isContentCheckOutstanding(campaign)) throw new AppError(INVALID_LINK, 404);
      if (campaign.creatorId === user.id) throw new AppError('The organizer cannot accept an invitation meant for the beneficiary.', 403);
      const wantsOrg = campaign.onBehalf.beneficiaryType === 'organization';
      if (wantsOrg !== (user.role === 'organization'))
        throw new AppError(wantsOrg ? 'This campaign is for an organization. Accept it from the organization\'s Ujimora account.' : 'This campaign is for a person. Accept it from a personal Ujimora account, not an organization account.', 403);
      if (campaign.onBehalf.consentStatus !== 'pending') throw new AppError('This campaign is no longer waiting for acceptance.', 409);

      const now = new Date();
      const payoutAuthorityUserId = campaign.onBehalf.payoutArrangement === 'beneficiary' ? user.id : campaign.creatorId;
      // Tiering alone would have published it; consent was the only thing holding it.
      const publish = campaign.status === CampaignStatus.PENDING_REVIEW && !isContentCheckOutstanding(campaign) && campaign.endDate > now &&
        await consentPublishes(campaign);
      const nextStatus = publish ? (campaign.raisedAmount >= campaign.goalAmount ? CampaignStatus.FUNDED : CampaignStatus.ACTIVE) : campaign.status;
      const updated = await CampaignModel.updateOne({ _id: campaign._id, 'onBehalf.consentStatus': 'pending' }, {
        $set: {
          'onBehalf.consentStatus': 'accepted', 'onBehalf.beneficiaryUserId': user.id, 'onBehalf.consentAt': now,
          'onBehalf.consentBy': user.id, 'onBehalf.consentVersion': BENEFICIARY_CONSENT_VERSION,
          'onBehalf.payoutAuthorityUserId': payoutAuthorityUserId, status: nextStatus,
        },
        $inc: { payoutWriteVersion: 1 },
      });
      if (!updated.modifiedCount) throw new AppError('This campaign is no longer waiting for acceptance.', 409);
      await CampaignBeneficiaryInvitationModel.updateOne({ _id: invitation._id, status: 'pending' }, { $set: { status: 'accepted', decidedAt: now, decidedBy: user.id }, $unset: { email: 1 } });
      const campaignId = campaign._id.toString();
      await event({ campaignId, event: 'accepted', actorId: user.id, actorRole: 'beneficiary', invitationId: invitation._id.toString(), payoutArrangement: campaign.onBehalf.payoutArrangement, termsHash: termsHash(campaign), meta });
      await audit({ actorId: user.id, actorRole: user.role, action: 'campaign.beneficiary_accepted', campaignId, details: `Beneficiary accepted; payouts go to the ${campaign.onBehalf.payoutArrangement}`, path: '/beneficiary-invitations/accept',
        changes: [{ field: 'onBehalf.consentStatus', before: 'pending', after: 'accepted' }, ...(publish ? [{ field: 'status', before: campaign.status, after: nextStatus }] : [])] });
      await recordAccountNotice({ key: `on-behalf:accepted:${invitation._id}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'The beneficiary accepted your campaign', path: `/campaigns/${campaignId}`,
        body: `${campaign.onBehalf.beneficiaryName} accepted “${campaign.title}”.${publish ? ' It is now live.' : campaign.status === CampaignStatus.PENDING_REVIEW ? ' Our team now checks it before it goes live. We will let you know when it is reviewed.' : ''}` });
      logger.info({ event: 'on_behalf.consent_accepted', campaignId, arrangement: campaign.onBehalf.payoutArrangement }, 'beneficiary accepted');
      return { campaignId, status: nextStatus, invitationId: invitation._id.toString() };
    });
    // Still in review after the acceptance: staff are next, and are told so
    // (they could not approve it before the beneficiary accepted), unless it
    // has ended and can no longer be approved.
    if (accepted.status === CampaignStatus.PENDING_REVIEW) {
      const campaign = await CampaignModel.findById(accepted.campaignId);
      if (campaign && await staffAreNext(campaign)) await this.alertStaff(campaign, { kind: 'beneficiary_accepted', ref: accepted.invitationId });
    }
    return { campaignId: accepted.campaignId, status: accepted.status };
  }

  async decline(token: string, meta: RequestMeta, actorId?: string, reason?: string): Promise<void> {
    const found = await this.findInvitation(token);
    if (await this.expireIfDue(found)) throw new AppError('This invitation has expired.', 410);
    await new MongoUnitOfWork().run(async () => {
      const invitation = await CampaignBeneficiaryInvitationModel.findOneAndUpdate({ _id: found._id, status: 'pending' }, { $set: { status: 'declined', decidedAt: new Date(), ...(actorId ? { decidedBy: actorId } : {}) }, $unset: { email: 1 } }, { new: true });
      if (!invitation) throw new AppError('This invitation is no longer active.', 409);
      const campaign = await CampaignModel.findOneAndUpdate({ _id: invitation.campaignId, 'onBehalf.consentStatus': 'pending' }, { $set: { 'onBehalf.consentStatus': 'declined' }, $unset: { 'onBehalf.payoutAuthorityUserId': 1 } }, { new: true });
      if (!campaign?.onBehalf) return;
      const campaignId = campaign._id.toString();
      const note = reason?.trim().slice(0, 500);
      await event({ campaignId, event: 'declined', actorId, actorRole: 'invitee', invitationId: invitation._id.toString(), payoutArrangement: campaign.onBehalf.payoutArrangement, termsHash: termsHash(campaign), reason: note, meta });
      await audit({ actorId: actorId ?? 'invitee', actorRole: 'invitee', action: 'campaign.beneficiary_declined', campaignId, details: 'Beneficiary declined the campaign', reason: note, severity: 'warning', path: '/beneficiary-invitations/decline',
        changes: [{ field: 'onBehalf.consentStatus', before: 'pending', after: 'declined' }] });
      await recordAccountNotice({ key: `on-behalf:declined:${invitation._id}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'The beneficiary declined your campaign', path: `/campaigns/${campaignId}`,
        body: `${campaign.onBehalf.beneficiaryName} declined “${campaign.title}”. It cannot collect or pay out money for them. Contact support if this is a mistake.` });
      logger.info({ event: 'on_behalf.consent_declined', campaignId }, 'beneficiary declined');
    });
  }

  private async viewerRoles(campaign: CampaignDocument, userId: string | undefined, isAdmin: boolean) {
    const managerRole = await campaignManagerRole(campaign, userId);
    const beneficiary = !!userId && campaign.onBehalf?.beneficiaryUserId === userId;
    return { managerRole, beneficiary, admin: isAdmin };
  }

  async details(campaignId: string, viewer: { userId?: string; isAdmin: boolean }): Promise<CampaignBeneficiaryDetails> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
    if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError('This campaign is not run on someone\'s behalf.', 404);
    const roles = await this.viewerRoles(campaign, viewer.userId, viewer.isAdmin);
    if (!roles.managerRole && !roles.beneficiary && !roles.admin) throw new AppError('Campaign not found', 404);
    const latest = await CampaignBeneficiaryInvitationModel.findOne({ campaignId }).sort({ createdAt: -1 }).select('+email');
    const onBehalf = campaign.onBehalf;
    const authority = payoutAuthorityOf(campaign);
    const noMoney = campaign.raisedAmount === 0;
    const canManage = roles.managerRole === 'owner' || roles.managerRole === 'admin';
    // Held for the content check, or withdrawn while it was: written, never
    // sent, so no sent date or expiry.
    const unsent = latest?.status === 'held' || latest?.emailHash === WITHDRAWN_UNSENT;
    return {
      campaignId, creationMode: 'on_behalf', beneficiaryType: onBehalf.beneficiaryType, beneficiaryName: onBehalf.beneficiaryName,
      relationship: onBehalf.relationship, reason: onBehalf.reason, payoutArrangement: onBehalf.payoutArrangement,
      consentStatus: onBehalf.consentStatus, consentAt: onBehalf.consentAt?.toISOString(), linked: !!onBehalf.beneficiaryUserId,
      // The address itself is never returned: the manager may already know it, but the API should not confirm it.
      invitationEmailHint: canManage || roles.admin ? maskEmail(latest?.email) : undefined,
      invitationStatus: latest?.status, invitationSentAt: unsent ? undefined : latest?.createdAt?.toISOString(), invitationExpiresAt: unsent ? undefined : latest?.expiresAt?.toISOString(),
      payoutAuthority: !authority ? 'none' : authority === onBehalf.beneficiaryUserId ? 'beneficiary' : 'organization',
      publicationRequiresConsent: onBehalf.publicationRequiresConsent, donationsRequireConsent: onBehalf.donationsRequireConsent,
      // Only an invitation that still has its address can be sent again.
      canResendInvitation: canManage && ['pending', 'expired'].includes(onBehalf.consentStatus) && !isContentCheckOutstanding(campaign) && !!latest?.email,
      canChangeBeneficiary: canManage && noMoney && onBehalf.consentStatus !== 'accepted' && campaign.status !== CampaignStatus.BLOCKED && campaign.endDate > new Date(),
      canRevokeConsent: roles.beneficiary && noMoney && onBehalf.consentStatus === 'accepted',
      // What happens next, for the people running it: never a promise the rules do not keep.
      ...(roles.managerRole || roles.admin ? { nextStep: await nextStepOf(campaign) } : {}),
      viewer: { manager: !!roles.managerRole, beneficiary: roles.beneficiary, admin: roles.admin },
      organizerName: await organizerName(campaign.creatorId),
    };
  }

  private async requireManager(campaignId: string, actorId: string) {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
    if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError('This campaign is not run on someone\'s behalf.', 404);
    const role = await campaignManagerRole(campaign, actorId);
    if (role !== 'owner' && role !== 'admin') throw new AppError('Only the organizer can manage the beneficiary invitation.', 403);
    return campaign;
  }

  async resend(campaignId: string, actorId: string): Promise<{ expiresAt: string }> {
    const settings = await this.config.resolveOnBehalfConfig();
    return new MongoUnitOfWork().run(async () => {
      const campaign = await this.requireManager(campaignId, actorId);
      const onBehalf = campaign.onBehalf!;
      if (isContentCheckOutstanding(campaign)) throw new AppError(HELD_FOR_CONTENT_CHECK, 409);
      if (!['pending', 'expired'].includes(onBehalf.consentStatus)) throw new AppError('Only a pending or expired invitation can be sent again.', 409);
      const latest = await CampaignBeneficiaryInvitationModel.findOne({ campaignId }).sort({ createdAt: -1 }).select('+email');
      if (!latest?.email) throw new AppError('No invitation address is on file. Change the beneficiary to send a new invitation.', 409);
      if (Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) throw new AppError('An invitation was just sent. Wait a minute before sending another.', 429);
      // A write on the campaign serializes concurrent resends.
      await CampaignModel.updateOne({ _id: campaign._id }, { $set: { 'onBehalf.consentStatus': 'pending', 'onBehalf.invitedAt': new Date() } });
      const issued = await this.issueInvitation({
        campaignId, campaignTitle: campaign.title, beneficiaryName: onBehalf.beneficiaryName, email: latest.email,
        invitedBy: actorId, payoutArrangement: onBehalf.payoutArrangement, publicationRequiresConsent: onBehalf.publicationRequiresConsent,
        ttlHours: settings.invitationTtlHours, event: 'resent', actorRole: 'organizer', organizer: await organizerName(campaign.creatorId),
      });
      await audit({ actorId, actorRole: 'organizer', action: 'campaign.beneficiary_invitation_resent', campaignId, details: 'Beneficiary invitation sent again', path: '/campaigns/:id/beneficiary/invitation' });
      return { expiresAt: issued.expiresAt.toISOString() };
    });
  }

  private static assertChangeable(campaign: CampaignDocument): void {
    if (campaign.raisedAmount !== 0 || campaign.onBehalf!.consentStatus === 'accepted')
      throw new AppError('The beneficiary cannot be changed after they accept or after donations arrive. Contact support to request a change.', 409);
    if (campaign.status === CampaignStatus.BLOCKED) throw new AppError('This campaign is under review.', 409);
    // Review refuses an ended campaign, so a new invitation could never go out.
    if (campaign.endDate <= new Date()) throw new AppError('This campaign has ended, so its beneficiary can no longer be changed.', 409);
  }

  /**
   * Before any money, before consent and before the end date, the organizer
   * may correct who the campaign is for. The new name and reason are public
   * text nobody has checked, so they are admitted like a new campaign's
   * content: screened when the organizer allows it, and otherwise (or when
   * screening does not clear them) the campaign's content check reopens, the
   * new invitation is held, and staff are alerted. While a content check is
   * already outstanding, that check covers the change (staff are alerted only
   * if it had nobody to invite before). Only an admitted change keeps the
   * campaign's own rule for what its acceptance publishes.
   */
  async changeBeneficiary(campaignId: string, actorId: string, input: BeneficiaryChangeInput): Promise<ChangeBeneficiaryResult> {
    const settings = await this.config.resolveOnBehalfConfig();
    // Refused before anything is screened.
    const before = await this.requireManager(campaignId, actorId);
    MongoOnBehalfCampaigns.assertChangeable(before);
    // A manager writing public text for the organization must be free to publish, as for campaign updates.
    if (actorId !== before.creatorId && await ContentRestrictionModel.exists({ userId: actorId })) throw new AppError('Publishing is restricted. Contact support@ujimora.com to appeal.', 403);
    const admitted = isContentCheckOutstanding(before) ? undefined : await this.admitChange(before, input);

    const outcome = await new MongoUnitOfWork().run(async () => {
      const campaign = await this.requireManager(campaignId, actorId);
      const onBehalf = campaign.onBehalf!;
      MongoOnBehalfCampaigns.assertChangeable(campaign);
      const outstanding = isContentCheckOutstanding(campaign);
      // Staff cleared the check while this change was being screened: admit it again.
      if (!outstanding && !admitted) throw new AppError('Our team finished checking the campaign while you were editing. Save the change again.', 409);
      if (admitted && !outstanding && publicationFingerprint(changedVersion(campaign, input)) !== publicationFingerprint(admitted.submission))
        throw new AppError('The campaign changed while the new details were checked. Save the change again.', 409);
      // Admitted only when no check covers it already (one reopened meanwhile does).
      const admission: CampaignAdmission | undefined = outstanding ? undefined : admitted!.admission;
      // Not cleared by screening: the content check reopens for the new details.
      const reopenReason = admission?.outcome === 'staff_review' ? admission.reason : undefined;
      const reopen = !!reopenReason;
      const held = outstanding || reopen;
      // The outstanding check had nobody to invite (its invitation was
      // withdrawn when the content was declined): from now on staff can act.
      const named = await awaitsBeneficiary(campaign);
      const now = new Date();
      // A public campaign goes back to review: donors must see the reviewed beneficiary.
      const status = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED].includes(campaign.status) ? CampaignStatus.PENDING_REVIEW : campaign.status;
      await CampaignModel.updateOne({ _id: campaign._id }, {
        $set: {
          'onBehalf.beneficiaryType': input.beneficiaryType, 'onBehalf.beneficiaryName': input.beneficiaryName.trim(),
          'onBehalf.relationship': input.relationship, 'onBehalf.reason': input.reason.trim(),
          'onBehalf.payoutArrangement': input.payoutArrangement, 'onBehalf.consentStatus': 'pending', 'onBehalf.invitedAt': now, status,
          ...(admission ? { contentAdmission: {
            basis: admission.outcome === 'approved' ? admission.basis : 'staff_review',
            ...(admission.outcome === 'staff_review' ? { reason: admission.reason } : {}),
            ...admission.evidence, admittedAt: now, trigger: 'beneficiary_change',
          } } : {}),
          // Consent cannot publish details nobody checked: once staff clear
          // them, the campaign's own rule applies again.
          ...(reopenReason ? {
            contentReviewReason: reopenReason, contentReviewTrigger: 'beneficiary_change',
            'onBehalf.autoPublishAfterContentCheck': onBehalf.autoPublishOnConsent, 'onBehalf.autoPublishOnConsent': false,
          } : {}),
        },
        $unset: {
          'onBehalf.beneficiaryUserId': 1, 'onBehalf.payoutAuthorityUserId': 1, 'onBehalf.consentAt': 1, 'onBehalf.consentBy': 1,
          ...(reopen ? { contentReviewClearedAt: 1, contentReviewClearedBy: 1 } : {}),
          // Covered by the outstanding check, not admitted on its own: the
          // admission's fingerprint described the version this replaces, so
          // a staff decision binds only the version staff see.
          ...(admission ? {} : { 'contentAdmission.fingerprint': 1 }),
        },
        $inc: { reviewRevision: 1 },
      });
      // Same transaction: refuses a version declined meanwhile, and audits how it was admitted.
      if (admission) await this.deps.admission!.commitCampaign!(admitted!.submission, admission, campaign.id, { change: 'beneficiary', actorId });
      const issued = await this.issueInvitation({
        campaignId, campaignTitle: campaign.title, beneficiaryName: input.beneficiaryName.trim(), email: input.beneficiaryEmail,
        invitedBy: actorId, payoutArrangement: input.payoutArrangement, publicationRequiresConsent: onBehalf.publicationRequiresConsent,
        ttlHours: settings.invitationTtlHours, event: 'beneficiary_changed', actorRole: 'organizer', organizer: await organizerName(campaign.creatorId),
        held, admission: !admission || admission.outcome === 'staff_review' ? 'staff_review' : admission.basis,
      });
      await audit({ actorId, actorRole: 'organizer', action: 'campaign.beneficiary_changed', campaignId, details: 'Beneficiary changed before acceptance and before donations', method: 'PUT', path: '/campaigns/:id/beneficiary',
        changes: [
          { field: 'onBehalf.beneficiaryName', before: onBehalf.beneficiaryName, after: input.beneficiaryName.trim() },
          { field: 'onBehalf.payoutArrangement', before: onBehalf.payoutArrangement, after: input.payoutArrangement },
          ...(status !== campaign.status ? [{ field: 'status', before: campaign.status, after: status }] : []),
          ...(reopenReason ? [{ field: 'contentReviewReason', before: campaign.contentReviewReason ?? null, after: reopenReason }] : []),
        ] });
      logger.info({ event: 'on_behalf.beneficiary_changed', campaignId, held, reopened: reopen }, 'beneficiary changed before acceptance');
      return { held, reopen, named, invitationId: issued.invitationId };
    });

    const after = await CampaignModel.findById(campaignId);
    // Staff are told whenever the change leaves them the next to act: the
    // content check reopened, a check that had nobody to invite now has a
    // beneficiary, or no consent is needed before they approve. (A check
    // already outstanding with an invitation held was announced when it opened.)
    if (after && (outcome.reopen || outcome.named || !outcome.held) && await staffAreNext(after)) await this.alertStaff(after, { kind: 'beneficiary_changed', ref: outcome.invitationId });
    return { invitationHeld: outcome.held, ...(after ? { nextStep: await nextStepOf(after) } : {}) };
  }

  /** Admits a changed beneficiary like new content, before the change is stored (screening can take seconds). */
  private async admitChange(campaign: CampaignDocument, input: BeneficiaryChangeInput): Promise<{ submission: PublicationSubmission; admission: CampaignAdmission }> {
    const admission = this.deps.admission;
    if (!admission?.admitCampaign || !admission.commitCampaign) throw new AppError('Campaign safety review is unavailable', 503);
    const submission = changedVersion(campaign, input);
    // The campaign's photos and video were checked already (or it has none): only the text is new.
    return { submission, admission: await admission.admitCampaign(submission, { mediaReviewed: true }) };
  }

  /** The beneficiary may withdraw consent while no money has been raised; after that, staff decide. */
  async revokeConsent(campaignId: string, userId: string, meta: RequestMeta): Promise<void> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    await new MongoUnitOfWork().run(async () => {
      const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
      if (!campaign?.onBehalf || campaign.onBehalf.beneficiaryUserId !== userId) throw new AppError('Campaign not found', 404);
      if (campaign.onBehalf.consentStatus !== 'accepted') throw new AppError('There is no accepted consent to withdraw.', 409);
      if (campaign.raisedAmount !== 0) throw new AppError('Donations have already arrived, so withdrawing consent needs a support review. Contact support@ujimora.com.', 409);
      const unpublish = campaign.onBehalf.publicationRequiresConsent && [CampaignStatus.ACTIVE, CampaignStatus.FUNDED].includes(campaign.status);
      await CampaignModel.updateOne({ _id: campaign._id, 'onBehalf.consentStatus': 'accepted' }, {
        $set: { 'onBehalf.consentStatus': 'revoked', ...(unpublish ? { status: CampaignStatus.PENDING_REVIEW } : {}) },
        $unset: { 'onBehalf.payoutAuthorityUserId': 1 }, $inc: { payoutWriteVersion: 1 },
      });
      await event({ campaignId, event: 'revoked', actorId: userId, actorRole: 'beneficiary', payoutArrangement: campaign.onBehalf.payoutArrangement, termsHash: termsHash(campaign), meta });
      await audit({ actorId: userId, actorRole: 'beneficiary', action: 'campaign.beneficiary_revoked', campaignId, details: 'Beneficiary withdrew consent', severity: 'warning', path: '/campaigns/:id/beneficiary/consent/revoke',
        changes: [{ field: 'onBehalf.consentStatus', before: 'accepted', after: 'revoked' }] });
      await recordAccountNotice({ key: `on-behalf:revoked:${campaignId}:${Date.now()}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'The beneficiary withdrew their consent', path: `/campaigns/${campaignId}`,
        body: `${campaign.onBehalf.beneficiaryName} withdrew consent for “${campaign.title}”. It cannot collect or pay out money for them.` });
      logger.info({ event: 'on_behalf.consent_revoked', campaignId }, 'beneficiary withdrew consent');
    });
  }

  async listForBeneficiary(userId: string): Promise<BeneficiaryCampaignListItem[]> {
    const campaigns = await CampaignModel.find({ 'onBehalf.beneficiaryUserId': userId, deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(100);
    return Promise.all(campaigns.map(async campaign => ({
      id: campaign._id.toString(), slug: campaign.slug, title: campaign.title, status: campaign.status,
      raisedAmount: campaign.raisedAmount, goalAmount: campaign.goalAmount, currency: campaign.currency,
      organizerName: await organizerName(campaign.creatorId), consentStatus: campaign.onBehalf!.consentStatus,
      payoutArrangement: campaign.onBehalf!.payoutArrangement, payoutAuthority: payoutAuthorityOf(campaign) === userId,
      endDate: campaign.endDate.toISOString(),
    })));
  }

  /** Staff: the consent history, oldest first. No addresses are stored in it. */
  async consentEvents(campaignId: string): Promise<{ event: string; actorRole?: string; actorId?: string; payoutArrangement?: string; reason?: string; consentVersion?: string; admission?: string; createdAt: string }[]> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const events = await CampaignBeneficiaryConsentEventModel.find({ campaignId }).sort({ createdAt: 1, _id: 1 }).limit(500).lean();
    return events.map(e => ({ event: e.event, actorRole: e.actorRole ?? undefined, actorId: e.actorId ?? undefined, payoutArrangement: e.payoutArrangement ?? undefined,
      reason: e.reason ?? undefined, consentVersion: e.consentVersion ?? undefined, admission: e.admission ?? undefined, createdAt: (e.createdAt as Date).toISOString() }));
  }

  /**
   * Staff: point a campaign at a different beneficiary. Consent and payout
   * authority start over. The invitation waits while the content check does.
   */
  async reassign(campaignId: string, adminId: string, input: BeneficiaryInput, reason: string): Promise<{ invitationHeld: boolean }> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const settings = await this.config.resolveOnBehalfConfig();
    const outcome = await new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.findOneAndUpdate({ _id: adminId, role: 'admin', deletedAt: null }, { $inc: { staffActionVersion: 1 } });
      if (!staff) throw new AppError('Current administrator access is required.', 403);
      const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
      if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError('This campaign is not run on someone\'s behalf.', 404);
      // Staff cannot steer a campaign they run, benefit from or are invited to benefit from, nor name themselves.
      const ownHash = sha256(normalizeEmail(staff.email));
      if (campaign.creatorId === adminId || campaign.onBehalf.beneficiaryUserId === adminId ||
        await CampaignBeneficiaryInvitationModel.exists({ campaignId, status: { $in: ['held', 'pending'] }, emailHash: ownHash }))
        throw new AppError('Another administrator must change the beneficiary of a campaign you are part of.', 403);
      if (sha256(normalizeEmail(input.beneficiaryEmail)) === ownHash) throw new AppError('You cannot name yourself as the beneficiary. Ask another administrator.', 403);
      const before = campaign.onBehalf;
      // The outstanding check had nobody to invite: from now on staff can act on it.
      const named = await awaitsBeneficiary(campaign);
      await CampaignModel.updateOne({ _id: campaign._id }, {
        $set: {
          'onBehalf.beneficiaryType': input.beneficiaryType, 'onBehalf.beneficiaryName': input.beneficiaryName.trim(),
          'onBehalf.relationship': input.relationship, 'onBehalf.reason': input.reason.trim(),
          'onBehalf.payoutArrangement': input.payoutArrangement, 'onBehalf.consentStatus': 'pending', 'onBehalf.invitedAt': new Date(),
        },
        // The admission's fingerprint described the version this replaces: a
        // later staff decision binds only the version staff see.
        $unset: { 'onBehalf.beneficiaryUserId': 1, 'onBehalf.payoutAuthorityUserId': 1, 'onBehalf.consentAt': 1, 'onBehalf.consentBy': 1, 'contentAdmission.fingerprint': 1 },
        $inc: { reviewRevision: 1, payoutWriteVersion: 1 },
      });
      const issued = await this.issueInvitation({
        campaignId, campaignTitle: campaign.title, beneficiaryName: input.beneficiaryName.trim(), email: input.beneficiaryEmail,
        invitedBy: adminId, payoutArrangement: input.payoutArrangement, publicationRequiresConsent: before.publicationRequiresConsent,
        ttlHours: settings.invitationTtlHours, event: 'reassigned', actorRole: 'admin', reason, organizer: await organizerName(campaign.creatorId),
        held: isContentCheckOutstanding(campaign),
      });
      await audit({ actorId: adminId, actorRole: 'admin', action: 'campaign.beneficiary_reassigned', campaignId, details: 'Staff reassigned the beneficiary; consent and payout authority reset', reason, severity: 'warning', path: '/admin/campaigns/:id/beneficiary/reassign',
        changes: [{ field: 'onBehalf.beneficiaryName', before: before.beneficiaryName, after: input.beneficiaryName.trim() }, { field: 'onBehalf.consentStatus', before: before.consentStatus, after: 'pending' }, { field: 'onBehalf.payoutAuthorityUserId', before: before.payoutAuthorityUserId ?? null, after: null }] });
      await recordAccountNotice({ key: `on-behalf:reassigned:${campaignId}:${Date.now()}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'Support changed your campaign\'s beneficiary', path: `/campaigns/${campaignId}`,
        body: `The beneficiary of “${campaign.title}” is now ${input.beneficiaryName.trim()}. ${isContentCheckOutstanding(campaign) ? 'They will be invited to accept it once our team has checked the campaign' : 'They have been invited to accept it'}; payouts are paused until they do.` });
      if (before.beneficiaryUserId) await recordAccountNotice({ key: `on-behalf:unlinked:${campaignId}:${before.beneficiaryUserId}:${Date.now()}`, userId: before.beneficiaryUserId, type: 'on_behalf',
        title: 'A campaign is no longer linked to you', path: '/my-campaigns', body: `Support changed the beneficiary of “${campaign.title}”. Contact support@ujimora.com if you have questions.` });
      logger.info({ event: 'on_behalf.reassigned', campaignId }, 'staff reassigned the beneficiary');
      return { invitationHeld: isContentCheckOutstanding(campaign), named, invitationId: issued.invitationId };
    });
    // A check that had nobody to invite is the team's to decide again.
    if (outcome.named) {
      const after = await CampaignModel.findById(campaignId);
      if (after && await staffAreNext(after)) await this.alertStaff(after, { kind: 'beneficiary_reassigned', ref: outcome.invitationId });
    }
    return { invitationHeld: outcome.invitationHeld };
  }

  /** Staff: a controlled override of who may request payouts. */
  async setPayoutAuthority(campaignId: string, adminId: string, target: 'beneficiary' | 'organization' | 'none', reason: string): Promise<void> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    await new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.findOneAndUpdate({ _id: adminId, role: 'admin', deletedAt: null }, { $inc: { staffActionVersion: 1 } });
      if (!staff) throw new AppError('Current administrator access is required.', 403);
      const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
      if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError('This campaign is not run on someone\'s behalf.', 404);
      if (campaign.creatorId === adminId || campaign.onBehalf.beneficiaryUserId === adminId) throw new AppError('Another administrator must decide payout authority for a campaign you are part of.', 403);
      if (target !== 'none' && campaign.onBehalf.consentStatus !== 'accepted') throw new AppError('Payout authority can only be assigned after the beneficiary accepts.', 409);
      if (target === 'beneficiary' && !campaign.onBehalf.beneficiaryUserId) throw new AppError('No beneficiary account is linked yet.', 409);
      const before = campaign.onBehalf.payoutAuthorityUserId ?? null;
      const after = target === 'beneficiary' ? campaign.onBehalf.beneficiaryUserId! : target === 'organization' ? campaign.creatorId : null;
      await CampaignModel.updateOne({ _id: campaign._id }, {
        ...(after ? { $set: { 'onBehalf.payoutAuthorityUserId': after, 'onBehalf.payoutArrangement': target } } : { $unset: { 'onBehalf.payoutAuthorityUserId': 1 } }),
        $inc: { payoutWriteVersion: 1 },
      });
      await event({ campaignId, event: 'payout_authority_changed', actorId: adminId, actorRole: 'admin', payoutArrangement: target, reason });
      await audit({ actorId: adminId, actorRole: 'admin', action: 'campaign.payout_authority_changed', campaignId, details: `Staff set payout authority to ${target}`, reason, severity: 'warning', method: 'PUT', path: '/admin/campaigns/:id/payout-authority',
        changes: [{ field: 'onBehalf.payoutAuthorityUserId', before, after }] });
      const body = `Support changed who can request payouts for “${campaign.title}”: ${target === 'none' ? 'payouts are paused' : target === 'beneficiary' ? 'the beneficiary' : 'the organizer'}.`;
      for (const userId of [campaign.creatorId, campaign.onBehalf.beneficiaryUserId]) {
        if (userId) await recordAccountNotice({ key: `on-behalf:authority:${campaignId}:${userId}:${Date.now()}`, userId, type: 'on_behalf', title: 'Payout access changed', path: `/campaigns/${campaignId}`, body });
      }
      logger.info({ event: 'on_behalf.payout_authority_changed', campaignId, target }, 'staff changed payout authority');
    });
  }

  private async expireOne(invitationId: string): Promise<void> {
    await new MongoUnitOfWork().run(async () => {
      const invitation = await CampaignBeneficiaryInvitationModel.findOneAndUpdate({ _id: invitationId, status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired', decidedAt: new Date() } }, { new: true });
      if (!invitation) return;
      const campaign = await CampaignModel.findOneAndUpdate({ _id: invitation.campaignId, 'onBehalf.consentStatus': 'pending' }, { $set: { 'onBehalf.consentStatus': 'expired' } }, { new: true });
      await event({ campaignId: invitation.campaignId, event: 'expired', actorRole: 'system', invitationId });
      if (campaign?.onBehalf) await recordAccountNotice({ key: `on-behalf:expired:${invitationId}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'Your beneficiary invitation expired', path: `/campaigns/${invitation.campaignId}`,
        body: `${campaign.onBehalf.beneficiaryName} did not respond to the invitation for “${campaign.title}” in time. Send it again from the campaign page.` });
      logger.info({ event: 'on_behalf.invitation_expired', campaignId: invitation.campaignId }, 'beneficiary invitation expired');
    });
  }

  /** Background sweep: expire invitations nobody answered. */
  async expireDue(limit = 100): Promise<number> {
    const due = await CampaignBeneficiaryInvitationModel.find({ status: 'pending', expiresAt: { $lte: new Date() } }).select('_id').limit(limit).lean();
    for (const invitation of due) {
      try { await this.expireOne(invitation._id.toString()); } catch (error) { logger.warn({ err: error, invitationId: invitation._id }, 'beneficiary invitation expiry failed'); }
    }
    return due.length;
  }
}
