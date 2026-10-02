import { createHash } from 'node:crypto';
import { hasCurrentLegalAcceptance } from '@ubuntu-fund/types';
import { UserModel } from '../../../database/models/UserModel.js';
import { OrganizationMemberModel } from '../../../database/models/OrganizationMemberModel.js';
import { ContentRestrictionModel } from '../../../database/models/ContentRestrictionModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** An organization's public identity: what an organization.profile review holds (its text, in this key order). */
export interface OrganizationIdentityFields {
  organizationName: string;
  website: string;
}

type StoredOrganization = { organizationProfileRevision?: number | null; organizationName?: string | null; website?: string | null };

/**
 * The organization identity version a change is proposed against: its name,
 * website and revision, bound to the organization. Every saved identity bumps
 * the revision, so a version proposed against earlier details never matches again.
 */
export function organizationIdentityVersion(organizationId: string, organization: StoredOrganization): string {
  return createHash('sha256').update(JSON.stringify([
    organizationId, organization.organizationProfileRevision ?? 0, organization.organizationName ?? '', organization.website ?? '',
  ])).digest('hex');
}

/** True when the fields are the organization's current details: saving them publishes nothing new. */
export function isCurrentOrganizationIdentity(organization: StoredOrganization, fields: OrganizationIdentityFields): boolean {
  return fields.organizationName === (organization.organizationName ?? '') && fields.website === (organization.website ?? '');
}

export interface OrganizationIdentityChange {
  /** The owner (the organization itself) or a teammate with the admin role. */
  actorId: string;
  /** The actor's credential version ('' when it never rotated); fenced inside the transaction. */
  authVersion: string;
  organizationId: string;
  fields: OrganizationIdentityFields;
  /** organizationIdentityVersion of the details the change was proposed against. */
  baseVersion: string;
  /** Publishing on approval: the review whose approval publishes the change, noted in the audit. */
  reviewId?: string;
}

/**
 * The organization's public name and website, as one fenced write inside the
 * caller's transaction. Shared by the author's own request
 * (PUT /organization-team/:organizationId/profile) and publishing on approval,
 * so both run the same checks: the actor's credentials, closure and agreement,
 * a restriction on the actor or the organization, a teammate's current admin
 * role, the exact version the change was proposed against, and the
 * organization's own agreement. Audited in the same transaction. Refusals
 * carry a publication fence `code`.
 */
export class MongoOrganizationIdentityWrite {
  async commit(change: OrganizationIdentityChange): Promise<void> {
    const { actorId, authVersion, organizationId, fields, baseVersion } = change;
    // Real writes fence concurrent credential changes, closure and membership revocation.
    const actor = await UserModel.findOneAndUpdate({ _id: actorId, deletedAt: null,
      ...(authVersion ? { authVersion } : { $or: [{ authVersion: '' }, { authVersion: null }] }),
    }, { $inc: { profileWriteVersion: 1 } }, { new: true });
    if (!actor) throw new AppError('Your session ended. Sign in again before saving.', 401, undefined, 'account_session');
    if (actor.role !== 'admin' && !hasCurrentLegalAcceptance(actor.legalAcceptance)) throw new AppError('Accept the current agreement before publishing', 428, undefined, 'terms_required');
    // The same answer either way; publishing on approval tells a teammate when it is the organization.
    if (await ContentRestrictionModel.exists({ userId: actorId })) throw new AppError('Publishing is restricted', 403, undefined, 'publishing_restricted');
    if (actorId !== organizationId && await ContentRestrictionModel.exists({ userId: organizationId })) throw new AppError('Publishing is restricted', 403, undefined, 'organizer_restricted');
    if (actorId !== organizationId) {
      const membership = await OrganizationMemberModel.findOneAndUpdate({ organizationId, userId: actorId, status: 'active', role: 'admin' }, { $inc: { profileWriteVersion: 1 } }, { new: true });
      if (!membership) throw new AppError('You no longer have permission to edit this organization', 403, undefined, 'permission_changed');
    }
    const changed = () => new AppError('The organization changed during review. Reload its current details before retrying.', 409, undefined, 'stale_version');
    const organization = await UserModel.findOne({ _id: organizationId, role: 'organization', deletedAt: null }).lean();
    // A closed organization keeps the plain conflict: there is no newer version to submit.
    if (!organization) throw new AppError('The organization changed during review. Reload its current details before retrying.', 409);
    if (organizationIdentityVersion(organizationId, organization) !== baseVersion) throw changed();
    const revision = organization.organizationProfileRevision ?? 0;
    const saved = await UserModel.findOneAndUpdate({ _id: organizationId, role: 'organization', deletedAt: null,
      organizationName: organization.organizationName ?? null, website: organization.website ?? null,
      ...(revision === 0 ? { $or: [{ organizationProfileRevision: 0 }, { organizationProfileRevision: null }] } : { organizationProfileRevision: revision }),
    }, { $set: fields, $inc: { organizationProfileRevision: 1 } }, { new: true });
    if (!saved) throw changed();
    if (!hasCurrentLegalAcceptance(saved.legalAcceptance)) throw new AppError('The organization must accept the current agreement before publishing', 428, undefined, 'organization_terms_required');
    await AuditLogModel.create({
      actorId, actorRole: actor.role, action: 'organization.profile.updated', resource: organizationId,
      details: `Reviewed organization identity saved${change.reviewId ? ` via approved review ${change.reviewId}` : ''}; base version ${baseVersion}; revision ${saved.organizationProfileRevision}`,
      severity: 'info',
      ...(change.reviewId
        ? { method: 'INTERNAL', path: 'internal:publication.published' }
        : { method: 'PUT', path: '/organization-team/:organizationId/profile' }),
      statusCode: 200,
    });
  }
}
