import type { ShortLinkRepositoryPort } from '../../domain/ports/outbound/ShortLinkRepositoryPort.js';
import type { LiveSessionRepositoryPort } from '../../domain/ports/outbound/LiveSessionRepositoryPort.js';
import { logger } from '../../infrastructure/logging/logger.js';

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
    private readonly liveSessionRepo?: LiveSessionRepositoryPort
  ) {}

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
      target: updated.target,
      code: updated.code,
      campaignId: updated.campaignId,
    };
  }
}
