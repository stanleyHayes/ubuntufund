import type {
  SiteContentRepositoryPort,
  SiteContentRecord,
} from '../../domain/ports/outbound/SiteContentRepositoryPort.js';

/**
 * Public read of every content block, key-ordered. The marketing site can hydrate
 * all blocks in one request; the admin editor lists them for editing.
 */
export class ListSiteContentUseCase {
  constructor(private readonly siteContentRepo: SiteContentRepositoryPort) {}

  async execute(): Promise<SiteContentRecord[]> {
    return this.siteContentRepo.list();
  }
}
