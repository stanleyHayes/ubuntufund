import type {
  SiteContentRepositoryPort,
  SiteContentRecord,
} from '../../domain/ports/outbound/SiteContentRepositoryPort.js';

/**
 * Public read of a single content block by key. Null-safe: an unknown or empty
 * key resolves to `null` (the controller maps that to 404) rather than
 * throwing — the marketing site polls these at runtime and must degrade
 * gracefully.
 */
export class GetSiteContentUseCase {
  constructor(private readonly siteContentRepo: SiteContentRepositoryPort) {}

  async execute(key: string): Promise<SiteContentRecord | null> {
    const trimmed = (key ?? '').trim();
    if (!trimmed) return null;
    return this.siteContentRepo.getByKey(trimmed);
  }
}
