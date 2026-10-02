import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { AccountIdentity } from '../MongoAccountProfileWrite.js';
import type { PublicationApplyDeps } from './deps.js';

/** What an approved account.profile version publishes: the complete identity, onto the version it was proposed against. */
export interface AccountProfileProposal {
  identity: AccountIdentity;
  baseVersion: string;
}

const isText = (value: unknown): value is string => typeof value === 'string';

/** The complete identity the review holds (MongoAccountProfileWrite's text), or null when it is not one. */
export function accountIdentityOf(value: unknown): AccountIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { name, avatarUrl, coverUrl, country, publicProfile } = value as Record<string, unknown>;
  if (!isText(name) || !name.trim() || !isText(avatarUrl) || !isText(coverUrl) || !isText(country) || typeof publicProfile !== 'boolean') return null;
  return { name, avatarUrl, coverUrl, country, publicProfile };
}

/**
 * account.profile: publishes the approved public identity (name, photos,
 * country and visibility) through the account profile writer, exactly as the
 * author's own request writes it, design §4.4. The writer re-checks the
 * credentials, restriction and agreement, and that the identity is still the
 * version the change was proposed against (else `superseded`), in the
 * transaction that records the publication.
 */
export function accountProfileHandler(deps: PublicationApplyDeps): PublicationApplyHandler<AccountProfileProposal> {
  return {
    action: 'account.profile',
    parse: review => {
      // An account only ever proposes its own identity, against a version.
      if (review.resourceId !== review.actorId || !review.baseVersion) return null;
      const identity = accountIdentityOf(JSON.parse(review.text));
      return identity ? { identity, baseVersion: review.baseVersion } : null;
    },
    commit: context => deps.accountProfileWrite.applyApproved(
      { actorId: context.review.actorId, baseVersion: context.proposal.baseVersion },
      context.proposal.identity,
      context.author.authVersion,
      () => context.publish(context.review.actorId),
    ),
  };
}
