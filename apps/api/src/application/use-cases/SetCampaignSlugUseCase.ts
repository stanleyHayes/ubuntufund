import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { PublicationAdmissionPort } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { Campaign } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { slugify, isReservedSlug, isValidSlug } from '../utils/slug.js';

export interface SetCampaignSlugRequester {
  userId: string;
  role?: string;
}

function toDTO(entity: CampaignEntity): Campaign {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    slug: plain.slug || undefined,
    title: plain.title,
    description: plain.description,
    goalAmount: plain.goalAmount.amount,
    raisedAmount: plain.raisedAmount.amount,
    currency: plain.goalAmount.currency,
    category: plain.category,
    priority: plain.priority,
    status: plain.status,
    creatorId: plain.creatorId,
    beneficiaries: plain.beneficiaries,
    imageUrls: plain.imageUrls,
    startDate: plain.startDate,
    endDate: plain.endDate,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

/**
 * Let a campaign's owner (or an admin) set a custom vanity slug. The input is
 * normalized then validated for shape, the reserved denylist, and uniqueness
 * before being persisted.
 */
export class SetCampaignSlugUseCase {
  constructor(private readonly campaignRepo: CampaignRepositoryPort, private readonly admission?: PublicationAdmissionPort, private readonly userRepo?: UserRepositoryPort) {}

  async execute(
    campaignId: string,
    rawSlug: string,
    requester: SetCampaignSlugRequester,
    automatedReviewConsent = false
  ): Promise<Campaign> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError('Only the campaign owner can change its slug', 403);
    }

    const slug = slugify(rawSlug);
    if (isReservedSlug(slug)) {
      throw new AppError('That slug is reserved', 409);
    }
    if (!isValidSlug(slug)) {
      throw new AppError(
        'Slug must be 3–60 lowercase letters, numbers, and single hyphens',
        400
      );
    }

    // No-op if unchanged; otherwise enforce uniqueness across campaigns.
    if (slug !== campaign.slug) {
      const existing = await this.campaignRepo.findBySlug(slug);
      if (existing && existing.id !== campaignId) {
        throw new AppError('That slug is already taken', 409);
      }
      if (!this.admission) throw new AppError('Campaign safety review is unavailable', 503);
      await this.admission.assertAllowed({ actorId: requester.userId, action: 'campaign.slug', resourceId: campaignId, baseVersion: campaign.slug, text: slug, mediaUrls: [], automatedReviewConsent });
      if (!isOwner && (await this.userRepo?.findById(requester.userId))?.role !== 'admin') throw new AppError('Administrator access changed during review', 403);
      const updated = await this.campaignRepo.setSlug(campaignId, campaign.slug, slug);
      if (!updated) throw new AppError('The campaign URL changed while being reviewed. Reload and retry.', 409);
      return toDTO(updated);
    }

    return toDTO(campaign);
  }
}
