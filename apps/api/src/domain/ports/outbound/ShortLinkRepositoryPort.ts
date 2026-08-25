import type { ShortLinkEntity } from '../../entities/ShortLink.js';

export interface ShortLinkRepositoryPort {
  save(shortLink: ShortLinkEntity): Promise<ShortLinkEntity>;
  findByCode(code: string): Promise<ShortLinkEntity | null>;
  existsByCode(code: string): Promise<boolean>;
  findByCampaignId(campaignId: string): Promise<ShortLinkEntity[]>;
  /**
   * Atomically increment `scanCount` and append a coarse scan record, capping
   * the retained scan log. Returns the updated short link, or null when no link
   * with `code` exists.
   */
  recordScan(code: string, source?: string): Promise<ShortLinkEntity | null>;
}
