import type { PublicationAdmissionPort, PublicationSubmission } from '../../domain/ports/outbound/PublicationAdmissionPort.js';
import type { Campaign } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignSlugWritePort } from '../../domain/ports/outbound/CampaignSlugWritePort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { slugify, isReservedSlug, isValidSlug } from '../utils/slug.js';

export interface SetCampaignSlugRequester {
  userId: string;
  role?: string;
  /** The credential version the request was authenticated with (`req.authVersion`). */
  authVersion?: string;
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

/** The requested address, normalized; a reserved or malformed one is refused. */
function requestedSlug(rawSlug: string): string {
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
  return slug;
}

/**
 * Let a campaign's owner (or an admin) set a custom vanity slug. The input is
 * normalized then validated for shape, the reserved denylist, and uniqueness
 * before it goes to the publication review. The change itself is written by
 * the slug writer (MongoCampaignSlugWrite), which repeats those checks in one
 * transaction with the account fence, the actor's current permission, the
 * single-use consumption of the approval and the audit. Publishing on
 * approval changes the address through the same writer.
 */
export class SetCampaignSlugUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly admission?: PublicationAdmissionPort,
    private readonly slugWrite?: CampaignSlugWritePort,
  ) {}

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

    const slug = requestedSlug(rawSlug);
    // No-op if unchanged (an older client saving again after its change was
    // published on approval, say); otherwise enforce uniqueness across campaigns.
    // The current address is still the newest version: a change held before it
    // is never published by its approval (it is superseded).
    if (slug === campaign.slug) {
      const unchanged = await this.admission?.supersedeOpenVersions?.(
        { actorId: requester.userId, action: 'campaign.slug', resourceId: campaignId },
        async () => (await this.campaignRepo.findById(campaignId))?.slug === slug,
      ) ?? true;
      if (!unchanged) throw new AppError('The campaign URL changed while being reviewed. Reload and retry.', 409);
      return toDTO(campaign);
    }

    const existing = await this.campaignRepo.findBySlug(slug);
    if (existing && existing.id !== campaignId) {
      throw new AppError('That slug is already taken', 409);
    }
    const admission = this.admission;
    if (!admission?.assertCurrent || !this.slugWrite) throw new AppError('Campaign safety review is unavailable', 503);
    const submission: PublicationSubmission = {
      actorId: requester.userId, action: 'campaign.slug', resourceId: campaignId, baseVersion: campaign.slug, text: slug, mediaUrls: [],
      automatedReviewConsent, authVersion: requester.authVersion,
    };
    await admission.assertAllowed(submission);
    const updated = await this.slugWrite.write({
      actorId: requester.userId, authVersion: requester.authVersion ?? '', campaignId, expectedSlug: campaign.slug, slug,
      // Approvals are single-use: consumed in the transaction that changes the address.
      consumeApproval: () => admission.assertCurrent!(submission, { publishedResourceId: campaignId }),
    });
    return toDTO(updated);
  }
}
