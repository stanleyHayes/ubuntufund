import type { ShortLinkRepositoryPort } from '../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CreatorProfileRepositoryPort } from '../../domain/ports/outbound/CreatorProfileRepositoryPort.js';
import type { ShortLinkEntity } from '../../domain/entities/ShortLink.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { buildShortLinkTarget } from '../utils/shortLinkTarget.js';

/** What redirect-time resolution needs; without it the stored target is used. */
export interface ShortLinkDestinationContext {
  campaignRepo: Pick<CampaignRepositoryPort, 'findById'>;
  creatorProfiles?: Pick<CreatorProfileRepositoryPort, 'findByUserId'>;
  publicWebUrl: string;
}

export interface ResolvedShortLink {
  target: string;
  code: string;
  campaignId: string;
}

const MAX_SOURCE_LENGTH = 64;

/** Normalize a raw attribution hint into a short, safe source token. */
function normalizeSource(source?: string): string | undefined {
  if (!source) return undefined;
  const trimmed = source.trim().slice(0, MAX_SOURCE_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Resolve a short code to its destination, recording a coarse scan (source +
 * timestamp) as a side effect. When the scanned link is bound to a live
 * session, the session's `scans` stat is bumped too. Returns null when the code
 * is unknown.
 */
export class ResolveShortLinkUseCase {
  constructor(
    private readonly shortLinkRepo: ShortLinkRepositoryPort,
    private readonly liveSessionRepo?: LiveSessionRepositoryPort,
    private readonly destinations?: ShortLinkDestinationContext
  ) {}

  /**
   * Printed QR codes outlive a campaign's vanity slug, so the destination is
   * rebuilt from the link's stored kind/params and the campaign's *current*
   * slug (and the organiser's creator handle) on every scan. The target stored
   * at creation is only a fallback when the campaign cannot be read.
   */
  private async destination(link: ShortLinkEntity): Promise<string> {
    if (!this.destinations) return link.target;
    try {
      const campaign = await this.destinations.campaignRepo.findById(link.campaignId);
      if (!campaign) return link.target;
      const creatorHandle = link.kind === 'creator'
        ? (await this.destinations.creatorProfiles?.findByUserId(campaign.creatorId))?.toPlain().handle || undefined
        : undefined;
      return buildShortLinkTarget(this.destinations.publicWebUrl, {
        kind: link.kind,
        campaignRef: campaign.slug || campaign.id,
        creatorId: campaign.creatorId,
        creatorHandle,
        liveSessionId: link.liveSessionId,
        presetAmount: link.presetAmount,
        label: link.label,
      });
    } catch (error) {
      logger.error({ err: error, code: link.code }, 'short-link destination lookup failed; using stored target');
      return link.target;
    }
  }

  async execute(
    code: string,
    source?: string
  ): Promise<ResolvedShortLink | null> {
    const updated = await this.shortLinkRepo.recordScan(
      code,
      normalizeSource(source)
    );
    if (!updated) return null;

    // Attribute the scan to a live session when the link is bound to one. A
    // failure here must never break the redirect, so it's best-effort.
    if (updated.liveSessionId && this.liveSessionRepo) {
      try {
        await this.liveSessionRepo.incrementStats(updated.liveSessionId, {
          scans: 1,
        });
      } catch (error) {
        logger.error(
          { err: error, liveSessionId: updated.liveSessionId },
          'failed to attribute short-link scan to live session'
        );
      }
    }

    return {
      target: await this.destination(updated),
      code: updated.code,
      campaignId: updated.campaignId,
    };
  }
}
