import { isValidObjectId } from 'mongoose';
import type { CampaignEntity } from '../../../../domain/entities/Campaign.js';
import type { CampaignRepositoryPort } from '../../../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignSlugChange, CampaignSlugWritePort } from '../../../../domain/ports/outbound/CampaignSlugWritePort.js';
import { isReservedSlug, isValidSlug } from '../../../../application/utils/slug.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { AppError, isDuplicateKeyError } from '../../inbound/middleware/errorHandler.js';
import { MongoCampaignCreation } from './MongoCampaignCreation.js';

/** The publisher fence every publishing write runs in (MongoCampaignCreation). */
interface PublisherFence {
  run<T>(userId: string, authVersion: string, work: () => Promise<T>): Promise<T>;
}

const campaignGone = () => new AppError('Campaign not found', 404, undefined, 'item_unavailable');
const accessChanged = () => new AppError('Administrator access changed during review', 403, undefined, 'permission_changed');
const reserved = () => new AppError('That slug is reserved', 409, undefined, 'address_taken');
const invalid = () => new AppError('Slug must be 3–60 lowercase letters, numbers, and single hyphens', 400, undefined, 'address_taken');
const taken = () => new AppError('That slug is already taken', 409, undefined, 'address_taken');
const changed = () => new AppError('The campaign URL changed while being reviewed. Reload and retry.', 409, undefined, 'stale_version');

/**
 * campaign.slug's writer (CampaignSlugWritePort): the owner's or an
 * administrator's request (SetCampaignSlugUseCase) and publishing on approval
 * (publication-apply/campaignSlug) change a campaign's web address through
 * the same transaction and checks. Old addresses keep resolving: the previous
 * one joins `previousSlugs`, which no other campaign may take. The audit names
 * no address: the change is public on the campaign, and the reviewed version
 * stays on its review record.
 */
export class MongoCampaignSlugWrite implements CampaignSlugWritePort {
  constructor(private readonly campaigns: CampaignRepositoryPort, private readonly fence: PublisherFence = new MongoCampaignCreation()) {}

  async write(change: CampaignSlugChange): Promise<CampaignEntity> {
    if (!isValidObjectId(change.campaignId)) throw campaignGone();
    try {
      return await this.fence.run(change.actorId, change.authVersion, async () => {
        await change.consumeApproval?.();
        const campaign = await this.campaigns.findById(change.campaignId);
        if (!campaign) throw campaignGone();
        // Read after the fence wrote the actor's account: a concurrent demotion conflicts with this change.
        const actor = await UserModel.findById(change.actorId).select('role').lean();
        if (campaign.creatorId !== change.actorId && actor?.role !== 'admin') throw accessChanged();
        if (isReservedSlug(change.slug)) throw reserved();
        if (!isValidSlug(change.slug)) throw invalid();
        // A slug another campaign uses now, or used before (its old links), is never reassigned.
        const holder = await this.campaigns.findBySlug(change.slug);
        if (holder && holder.id !== change.campaignId) throw taken();
        const updated = await this.campaigns.setSlug(change.campaignId, change.expectedSlug, change.slug);
        if (!updated) throw changed();
        await AuditLogModel.create({
          actorId: change.actorId, ...(actor?.role ? { actorRole: actor.role } : {}), action: 'campaign.slug_changed', resource: change.campaignId,
          details: change.reviewId
            ? `Campaign web address changed on the approval of publication review ${change.reviewId}; earlier addresses keep working`
            : 'Campaign web address changed; earlier addresses keep working',
          severity: 'info', statusCode: 200,
          ...(change.reviewId ? { method: 'INTERNAL', path: 'internal:publication.published' } : { method: 'PATCH', path: '/campaigns/:id/slug' }),
        });
        await change.recordPublication?.();
        return updated;
      });
    } catch (error) {
      // The unique index holds it: a deleted campaign's slug, or a campaign that took it meanwhile.
      if (isDuplicateKeyError(error, 'slug')) throw taken();
      throw error;
    }
  }
}
