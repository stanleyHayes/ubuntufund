import { createHash, randomBytes } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  BENEFICIARY_CONSENT_VERSION,
  CampaignStatus,
  type BeneficiaryCampaignListItem,
  type BeneficiaryInvitationPreview,
  type BeneficiaryPartyType,
  type BeneficiaryRelationship,
  type CampaignBeneficiaryDetails,
  type OnBehalfPayoutArrangement,
} from '@ubuntu-fund/types';
import { CampaignModel, type CampaignDocument } from '../../../database/models/CampaignModel.js';
import { CampaignBeneficiaryInvitationModel } from '../../../database/models/CampaignBeneficiaryInvitationModel.js';
import { CampaignBeneficiaryConsentEventModel, type BeneficiaryConsentEventType } from '../../../database/models/CampaignBeneficiaryConsentEventModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { campaignManagerRole, organizerName, recordAccountNotice } from './campaignManagers.js';
import { payoutAuthorityOf } from '../../../../domain/services/campaignPayoutAuthority.js';
import { logger } from '../../../logging/logger.js';
import type { OnBehalfSettings } from '../../../../application/services/CommercialConfigService.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const INVALID_LINK = 'This invitation link is not valid. Ask the organizer to send a new one.';
const RESEND_COOLDOWN_MS = 60_000;

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
}): Promise<void> {
  await CampaignBeneficiaryConsentEventModel.create({
    campaignId: input.campaignId, invitationId: input.invitationId, event: input.event, actorId: input.actorId,
    actorRole: input.actorRole, consentVersion: BENEFICIARY_CONSENT_VERSION, payoutArrangement: input.payoutArrangement,
    termsHash: input.termsHash, reason: input.reason, ip: input.meta?.ip, userAgent: input.meta?.userAgent?.slice(0, 300),
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
 * Campaigns run on someone else's behalf: beneficiary invitations, consent,
 * and the controls around them. Every decision is recorded in the append-only
 * consent log and the audit log inside the same transaction as the change.
 */
export class MongoOnBehalfCampaigns {
  constructor(
    private readonly emails: InvitationEmailPort,
    private readonly config: { resolveOnBehalfConfig(): Promise<OnBehalfSettings> },
  ) {}

  get invitationsAvailable(): boolean {
    return this.emails.configured;
  }

  resolveConfig(): Promise<OnBehalfSettings> {
    return this.config.resolveOnBehalfConfig();
  }

  /**
   * Creates a new invitation (superseding any pending one) and queues its
   * email. Must run inside the transaction that creates or changes the
   * campaign, so a rollback leaves neither a dangling invitation nor an email.
   */
  async issueInvitation(input: {
    campaignId: string; campaignTitle: string; beneficiaryName: string; email: string;
    invitedBy: string; payoutArrangement: OnBehalfPayoutArrangement; publicationRequiresConsent: boolean;
    ttlHours: number; event: 'invited' | 'resent' | 'beneficiary_changed' | 'reassigned';
    actorRole: 'organizer' | 'admin'; reason?: string; organizer?: string;
  }): Promise<{ invitationId: string; expiresAt: Date }> {
    if (!this.emails.configured) throw new AppError('Beneficiary invitations are temporarily unavailable. Please try again later.', 503);
    const now = new Date();
    await CampaignBeneficiaryInvitationModel.updateMany({ campaignId: input.campaignId, status: 'pending' }, { $set: { status: 'superseded', decidedAt: now } });
    // Only the newest invitation needs an address (to resend it); older ones drop theirs.
    await CampaignBeneficiaryInvitationModel.updateMany({ campaignId: input.campaignId, email: { $exists: true } }, { $unset: { email: 1 } });
    const token = randomBytes(32).toString('hex');
    const email = normalizeEmail(input.email);
    const expiresAt = new Date(now.getTime() + input.ttlHours * 3600_000);
    const [invitation] = await CampaignBeneficiaryInvitationModel.create([{
      campaignId: input.campaignId, tokenHash: sha256(token), emailHash: sha256(email), email,
      status: 'pending', invitedBy: input.invitedBy, expiresAt, consentVersion: BENEFICIARY_CONSENT_VERSION,
    }]);
    await event({ campaignId: input.campaignId, event: input.event, actorId: input.invitedBy, actorRole: input.actorRole, invitationId: invitation._id.toString(), payoutArrangement: input.payoutArrangement, reason: input.reason });
    await this.emails.enqueueBeneficiaryInvitation({
      invitationId: invitation._id.toString(), email, token, expiresAt,
      organizerName: input.organizer ?? 'The organizer', campaignTitle: input.campaignTitle, beneficiaryName: input.beneficiaryName,
      payoutArrangement: input.payoutArrangement, publicationRequiresConsent: input.publicationRequiresConsent,
    });
    logger.info({ event: 'on_behalf.invitation_issued', campaignId: input.campaignId, kind: input.event }, 'beneficiary invitation issued');
    return { invitationId: invitation._id.toString(), expiresAt };
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
    if (await this.expireIfDue(invitation)) invitation.status = 'expired';
    const campaign = await CampaignModel.findOne({ _id: invitation.campaignId, deletedAt: { $exists: false } });
    if (!campaign?.onBehalf) throw new AppError(INVALID_LINK, 404);
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
    return new MongoUnitOfWork().run(async () => {
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
      if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError(INVALID_LINK, 404);
      if (campaign.creatorId === user.id) throw new AppError('The organizer cannot accept an invitation meant for the beneficiary.', 403);
      const wantsOrg = campaign.onBehalf.beneficiaryType === 'organization';
      if (wantsOrg !== (user.role === 'organization'))
        throw new AppError(wantsOrg ? 'This campaign is for an organization. Accept it from the organization\'s Ujimora account.' : 'This campaign is for a person. Accept it from a personal Ujimora account, not an organization account.', 403);
      if (campaign.onBehalf.consentStatus !== 'pending') throw new AppError('This campaign is no longer waiting for acceptance.', 409);

      const now = new Date();
      const payoutAuthorityUserId = campaign.onBehalf.payoutArrangement === 'beneficiary' ? user.id : campaign.creatorId;
      // Tiering alone would have published it; consent was the only thing holding it.
      const publish = campaign.status === CampaignStatus.PENDING_REVIEW && campaign.onBehalf.autoPublishOnConsent &&
        !campaign.onBehalf.staffReviewRequired && campaign.endDate > now;
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
        body: `${campaign.onBehalf.beneficiaryName} accepted “${campaign.title}”.${publish ? ' It is now live.' : campaign.status === CampaignStatus.PENDING_REVIEW ? ' It is waiting for staff review before it goes live.' : ''}` });
      logger.info({ event: 'on_behalf.consent_accepted', campaignId, arrangement: campaign.onBehalf.payoutArrangement }, 'beneficiary accepted');
      return { campaignId, status: nextStatus };
    });
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
    return {
      campaignId, creationMode: 'on_behalf', beneficiaryType: onBehalf.beneficiaryType, beneficiaryName: onBehalf.beneficiaryName,
      relationship: onBehalf.relationship, reason: onBehalf.reason, payoutArrangement: onBehalf.payoutArrangement,
      consentStatus: onBehalf.consentStatus, consentAt: onBehalf.consentAt?.toISOString(), linked: !!onBehalf.beneficiaryUserId,
      // The address itself is never returned: the manager may already know it, but the API should not confirm it.
      invitationEmailHint: canManage || roles.admin ? maskEmail(latest?.email) : undefined,
      invitationStatus: latest?.status, invitationSentAt: latest?.createdAt?.toISOString(), invitationExpiresAt: latest?.expiresAt?.toISOString(),
      payoutAuthority: !authority ? 'none' : authority === onBehalf.beneficiaryUserId ? 'beneficiary' : 'organization',
      publicationRequiresConsent: onBehalf.publicationRequiresConsent, donationsRequireConsent: onBehalf.donationsRequireConsent,
      canResendInvitation: canManage && ['pending', 'expired'].includes(onBehalf.consentStatus),
      canChangeBeneficiary: canManage && noMoney && onBehalf.consentStatus !== 'accepted',
      canRevokeConsent: roles.beneficiary && noMoney && onBehalf.consentStatus === 'accepted',
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

  /** Before any money and before consent, the organizer may correct who the campaign is for. */
  async changeBeneficiary(campaignId: string, actorId: string, input: BeneficiaryInput): Promise<void> {
    const settings = await this.config.resolveOnBehalfConfig();
    await new MongoUnitOfWork().run(async () => {
      const campaign = await this.requireManager(campaignId, actorId);
      const onBehalf = campaign.onBehalf!;
      if (campaign.raisedAmount !== 0 || onBehalf.consentStatus === 'accepted')
        throw new AppError('The beneficiary cannot be changed after they accept or after donations arrive. Contact support to request a change.', 409);
      if (campaign.status === CampaignStatus.BLOCKED) throw new AppError('This campaign is under review.', 409);
      // A public campaign goes back to review: donors must see the reviewed beneficiary.
      const status = [CampaignStatus.ACTIVE, CampaignStatus.FUNDED].includes(campaign.status) ? CampaignStatus.PENDING_REVIEW : campaign.status;
      await CampaignModel.updateOne({ _id: campaign._id }, {
        $set: {
          'onBehalf.beneficiaryType': input.beneficiaryType, 'onBehalf.beneficiaryName': input.beneficiaryName.trim(),
          'onBehalf.relationship': input.relationship, 'onBehalf.reason': input.reason.trim(),
          'onBehalf.payoutArrangement': input.payoutArrangement, 'onBehalf.consentStatus': 'pending', 'onBehalf.invitedAt': new Date(), status,
        },
        $unset: { 'onBehalf.beneficiaryUserId': 1, 'onBehalf.payoutAuthorityUserId': 1, 'onBehalf.consentAt': 1, 'onBehalf.consentBy': 1 },
        $inc: { reviewRevision: 1 },
      });
      await this.issueInvitation({
        campaignId, campaignTitle: campaign.title, beneficiaryName: input.beneficiaryName.trim(), email: input.beneficiaryEmail,
        invitedBy: actorId, payoutArrangement: input.payoutArrangement, publicationRequiresConsent: onBehalf.publicationRequiresConsent,
        ttlHours: settings.invitationTtlHours, event: 'beneficiary_changed', actorRole: 'organizer', organizer: await organizerName(campaign.creatorId),
      });
      await audit({ actorId, actorRole: 'organizer', action: 'campaign.beneficiary_changed', campaignId, details: 'Beneficiary changed before acceptance and before donations', method: 'PUT', path: '/campaigns/:id/beneficiary',
        changes: [{ field: 'onBehalf.beneficiaryName', before: onBehalf.beneficiaryName, after: input.beneficiaryName.trim() }, { field: 'onBehalf.payoutArrangement', before: onBehalf.payoutArrangement, after: input.payoutArrangement }, ...(status !== campaign.status ? [{ field: 'status', before: campaign.status, after: status }] : [])] });
      logger.info({ event: 'on_behalf.beneficiary_changed', campaignId }, 'beneficiary changed before acceptance');
    });
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
  async consentEvents(campaignId: string): Promise<{ event: string; actorRole?: string; actorId?: string; payoutArrangement?: string; reason?: string; consentVersion?: string; createdAt: string }[]> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const events = await CampaignBeneficiaryConsentEventModel.find({ campaignId }).sort({ createdAt: 1 }).limit(500).lean();
    return events.map(e => ({ event: e.event, actorRole: e.actorRole ?? undefined, actorId: e.actorId ?? undefined, payoutArrangement: e.payoutArrangement ?? undefined,
      reason: e.reason ?? undefined, consentVersion: e.consentVersion ?? undefined, createdAt: (e.createdAt as Date).toISOString() }));
  }

  /** Staff: point a campaign at a different beneficiary. Consent and payout authority start over. */
  async reassign(campaignId: string, adminId: string, input: BeneficiaryInput, reason: string): Promise<void> {
    if (!isValidObjectId(campaignId)) throw new AppError('Campaign not found', 404);
    const settings = await this.config.resolveOnBehalfConfig();
    await new MongoUnitOfWork().run(async () => {
      const staff = await UserModel.findOneAndUpdate({ _id: adminId, role: 'admin', deletedAt: null }, { $inc: { staffActionVersion: 1 } });
      if (!staff) throw new AppError('Current administrator access is required.', 403);
      const campaign = await CampaignModel.findOne({ _id: campaignId, deletedAt: { $exists: false } });
      if (!campaign?.onBehalf || campaign.creationMode !== 'on_behalf') throw new AppError('This campaign is not run on someone\'s behalf.', 404);
      if (campaign.creatorId === adminId || campaign.onBehalf.beneficiaryUserId === adminId) throw new AppError('Another administrator must change the beneficiary of a campaign you are part of.', 403);
      const before = campaign.onBehalf;
      await CampaignModel.updateOne({ _id: campaign._id }, {
        $set: {
          'onBehalf.beneficiaryType': input.beneficiaryType, 'onBehalf.beneficiaryName': input.beneficiaryName.trim(),
          'onBehalf.relationship': input.relationship, 'onBehalf.reason': input.reason.trim(),
          'onBehalf.payoutArrangement': input.payoutArrangement, 'onBehalf.consentStatus': 'pending', 'onBehalf.invitedAt': new Date(),
        },
        $unset: { 'onBehalf.beneficiaryUserId': 1, 'onBehalf.payoutAuthorityUserId': 1, 'onBehalf.consentAt': 1, 'onBehalf.consentBy': 1 },
        $inc: { reviewRevision: 1, payoutWriteVersion: 1 },
      });
      await this.issueInvitation({
        campaignId, campaignTitle: campaign.title, beneficiaryName: input.beneficiaryName.trim(), email: input.beneficiaryEmail,
        invitedBy: adminId, payoutArrangement: input.payoutArrangement, publicationRequiresConsent: before.publicationRequiresConsent,
        ttlHours: settings.invitationTtlHours, event: 'reassigned', actorRole: 'admin', reason, organizer: await organizerName(campaign.creatorId),
      });
      await audit({ actorId: adminId, actorRole: 'admin', action: 'campaign.beneficiary_reassigned', campaignId, details: 'Staff reassigned the beneficiary; consent and payout authority reset', reason, severity: 'warning', path: '/admin/campaigns/:id/beneficiary/reassign',
        changes: [{ field: 'onBehalf.beneficiaryName', before: before.beneficiaryName, after: input.beneficiaryName.trim() }, { field: 'onBehalf.consentStatus', before: before.consentStatus, after: 'pending' }, { field: 'onBehalf.payoutAuthorityUserId', before: before.payoutAuthorityUserId ?? null, after: null }] });
      await recordAccountNotice({ key: `on-behalf:reassigned:${campaignId}:${Date.now()}`, userId: campaign.creatorId, type: 'on_behalf',
        title: 'Support changed your campaign\'s beneficiary', path: `/campaigns/${campaignId}`,
        body: `The beneficiary of “${campaign.title}” is now ${input.beneficiaryName.trim()}. They have been invited to accept it; payouts are paused until they do.` });
      if (before.beneficiaryUserId) await recordAccountNotice({ key: `on-behalf:unlinked:${campaignId}:${before.beneficiaryUserId}:${Date.now()}`, userId: before.beneficiaryUserId, type: 'on_behalf',
        title: 'A campaign is no longer linked to you', path: '/my-campaigns', body: `Support changed the beneficiary of “${campaign.title}”. Contact support@ujimora.com if you have questions.` });
      logger.info({ event: 'on_behalf.reassigned', campaignId }, 'staff reassigned the beneficiary');
    });
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
