import type { Campaign, CampaignPublicView } from '@ubuntu-fund/types';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { DonationRepositoryPort } from '../../domain/ports/outbound/DonationRepositoryPort.js';
import type { CampaignEntity } from '../../domain/entities/Campaign.js';

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

/** Collapse whitespace and clip the description into a share-card blurb. */
function toSummary(description: string, max = 200): string {
  const normalized = description.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Resolve a campaign by its vanity slug and return the public DTO plus a
 * denormalized `socialPreview` block (title/summary/image/amounts/canonicalUrl)
 * for share cards and OpenGraph meta tags.
 */
export class GetCampaignBySlugUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly publicWebUrl: string,
    private readonly donationRepo?: DonationRepositoryPort
  ) {}

  async execute(slug: string): Promise<CampaignPublicView | null> {
    // Older campaigns have no vanity slug; their public links use the Mongo ID.
    const entity = await this.campaignRepo.findBySlug(slug)
      ?? (/^[a-f0-9]{24}$/i.test(slug) ? await this.campaignRepo.findById(slug) : null);
    if (!entity) return null;

    const dto = toDTO(entity);
    if (this.donationRepo) {
      const counts = await this.donationRepo.countDistinctDonorsByCampaignIds([
        dto.id,
      ]);
      dto.donorCount = counts[dto.id] ?? 0;
    }

    const canonicalUrl = `${stripTrailingSlash(this.publicWebUrl)}/c/${dto.slug ?? dto.id}`;

    return {
      ...dto,
      socialPreview: {
        title: dto.title,
        summary: toSummary(dto.description),
        imageUrl: dto.imageUrls[0],
        raisedAmount: dto.raisedAmount,
        goalAmount: dto.goalAmount,
        currency: dto.currency,
        canonicalUrl,
      },
    };
  }
}
