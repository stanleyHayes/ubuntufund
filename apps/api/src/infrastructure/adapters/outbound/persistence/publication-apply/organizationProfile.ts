import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';
import { MongoOrganizationIdentityWrite, type OrganizationIdentityFields } from '../MongoOrganizationIdentityWrite.js';
import type { PublicationApplyDeps } from './deps.js';

/** What an approved organization.profile version publishes: the name and website, onto the version they were proposed against. */
export interface OrganizationProfileProposal {
  fields: OrganizationIdentityFields;
  baseVersion: string;
}

const WEBSITE = /^https?:\/\//i;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** The organization identity the review holds (the route's text), or null when it is not one. */
export function organizationIdentityOf(value: unknown): OrganizationIdentityFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { organizationName, website } = value as Record<string, unknown>;
  if (typeof organizationName !== 'string' || organizationName.trim().length < 2 || organizationName.length > 120) return null;
  if (typeof website !== 'string' || website.length > 500 || (website !== '' && !WEBSITE.test(website))) return null;
  return { organizationName, website };
}

/** The organization, still open, as this read sees it. */
const organizationExists = (organizationId: string) => UserModel.exists({ _id: organizationId, role: 'organization', deletedAt: null });

/**
 * organization.profile: publishes the approved organization name and website
 * through the organization identity writer the route uses, design §4.5. The
 * writer re-checks the actor's credentials and agreement, a restriction on
 * the actor or the organization, a teammate's current admin role, the
 * organization's agreement, and that its details are still the version the
 * change was proposed against (else `superseded`), in the transaction that
 * records the publication. A closed organization is `item_unavailable`.
 */
export function organizationProfileHandler(deps: PublicationApplyDeps): PublicationApplyHandler<OrganizationProfileProposal> {
  const identity = new MongoOrganizationIdentityWrite();
  return {
    action: 'organization.profile',
    parse: review => {
      if (!review.baseVersion || !OBJECT_ID.test(review.resourceId)) return null;
      const fields = organizationIdentityOf(JSON.parse(review.text));
      return fields ? { fields, baseVersion: review.baseVersion } : null;
    },
    precheck: async context => {
      if (!(await organizationExists(context.review.resourceId))) throw new PublicationApplyRefusal('not_published', 'item_unavailable');
    },
    commit: context => deps.uow.run(async () => {
      const organizationId = context.review.resourceId;
      // Read in this transaction's snapshot, which the writer reads too: closed meanwhile is not a newer version.
      if (!(await organizationExists(organizationId))) throw new PublicationApplyRefusal('not_published', 'item_unavailable');
      await identity.commit({
        actorId: context.review.actorId, authVersion: context.author.authVersion, organizationId,
        fields: context.proposal.fields, baseVersion: context.proposal.baseVersion, reviewId: context.review.id,
      });
      await context.publish(organizationId);
    }),
  };
}
