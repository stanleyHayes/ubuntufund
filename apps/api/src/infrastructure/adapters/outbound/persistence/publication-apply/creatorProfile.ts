import type { PublicationApplyContext, PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import { CreatorProfileEntity } from '../../../../../domain/entities/CreatorProfile.js';
import type { CreatorPageFields } from '../../../../../application/use-cases/SaveCreatorProfileUseCase.js';
import { isDuplicateKeyError } from '../../../inbound/middleware/errorHandler.js';
import { PublicationApplyRefusal } from '../../../inbound/middleware/publicationErrors.js';
import type { PublicationApplyDeps } from './deps.js';

/**
 * What an approved creator.profile version publishes: the complete page, onto
 * the revision it was proposed against (`null`: a first page).
 */
export interface CreatorProfileProposal {
  fields: CreatorPageFields;
  expectedRevision: number | null;
}

const REVISION = /^(?:0|[1-9]\d{0,9})$/;
const isText = (value: unknown): value is string => typeof value === 'string';
const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** The complete page the review holds (SaveCreatorProfileUseCase's text), or null when it is not a page that can be saved. */
export function creatorPageOf(value: unknown): CreatorPageFields | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const page = value as Record<string, unknown>;
  const { handle, displayName, tagline, bio, avatarUrl, coverUrl, tipsEnabled, presetAmounts, currency, thankYouMessage } = page;
  if (!isText(handle) || handle !== CreatorProfileEntity.normalizeHandle(handle) || !CreatorProfileEntity.isValidHandle(handle)) return null;
  if (!isText(displayName) || displayName.trim().length < 2) return null;
  if (!isText(tagline) || !isText(bio) || !isText(avatarUrl) || !isText(coverUrl) || !isText(thankYouMessage) || typeof tipsEnabled !== 'boolean') return null;
  if (!Array.isArray(presetAmounts) || !presetAmounts.every(isAmount)) return null;
  // Creator pages are GHS only.
  if (currency !== 'GHS') return null;
  return { handle, displayName, tagline, bio, avatarUrl, coverUrl, tipsEnabled, presetAmounts: [...presetAmounts], currency, thankYouMessage };
}

/**
 * creator.profile: publishes the approved creator page (a first page with its
 * balance row, or an edit) through the creator profile writer, exactly as the
 * author's own request saves it, design §4.6. The writer re-checks the
 * credentials, restriction and agreement, and that the page is still the
 * revision the change was proposed against (else `superseded`), in the
 * transaction that records the publication. The plan and the handle are
 * checked first, as the author's request checks them.
 */
export function creatorProfileHandler(deps: PublicationApplyDeps): PublicationApplyHandler<CreatorProfileProposal> {
  /** Why this page can't be published as approved now, by the reads the author's request makes; nothing to say when it can. */
  const precheck = async (context: PublicationApplyContext<CreatorProfileProposal>): Promise<void> => {
    const userId = context.review.actorId;
    const { fields, expectedRevision } = context.proposal;
    if (!(await deps.planLimits.creatorPolicy(userId)).eligible) throw new PublicationApplyRefusal('not_published', 'plan_ineligible');
    const holder = await deps.creatorProfiles.findByHandle(fields.handle);
    if (holder && holder.userId !== userId) throw new PublicationApplyRefusal('not_published', 'handle_taken');
    const current = await deps.creatorProfiles.findByUserId(userId);
    // A page created since a first page was proposed, or any save since an edit was.
    const edited = expectedRevision === null ? !!current : !current || current.revision !== expectedRevision;
    if (edited) throw new PublicationApplyRefusal('superseded', 'edited_since_submitted');
  };
  return {
    action: 'creator.profile',
    parse: review => {
      if (review.resourceId !== review.actorId) return null;
      const base = review.baseVersion ?? '';
      if (base !== 'new' && !REVISION.test(base)) return null;
      const fields = creatorPageOf(JSON.parse(review.text));
      return fields ? { fields, expectedRevision: base === 'new' ? null : Number(base) } : null;
    },
    precheck,
    commit: async context => {
      const userId = context.review.actorId;
      const { fields, expectedRevision } = context.proposal;
      try {
        await deps.uow.run(async () => {
          const profile = await deps.creatorProfiles.save(userId, fields, { expectedRevision, authVersion: context.author.authVersion, publicChange: true });
          await deps.creatorBalances.ensure(userId, fields.currency);
          await context.publish(profile.id);
        });
      } catch (error) {
        // The handle or a first page was claimed between the checks and the
        // write: say which. Anything else is tried again later.
        if (isDuplicateKeyError(error)) await precheck(context);
        throw error;
      }
    },
  };
}
