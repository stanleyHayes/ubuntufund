import type {
  SiteContentRepositoryPort,
  SiteContentRecord,
} from '../../domain/ports/outbound/SiteContentRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface UpsertSiteContentInput {
  key: string;
  /**
   * Optional content-type tag. When omitted on an update, the existing block's
   * type is preserved; on a first-time create it defaults to 'custom'.
   */
  type?: string;
  data: unknown;
  /** Admin user id performing the edit, recorded on the block. */
  updatedBy?: string;
}

/**
 * Admin-only create-or-replace of a content block. Guarded at the route layer
 * (authMiddleware + requireAdmin); this use case validates the payload and
 * delegates the atomic upsert to the repository.
 */
export class UpsertSiteContentUseCase {
  constructor(private readonly siteContentRepo: SiteContentRepositoryPort) {}

  async execute(input: UpsertSiteContentInput): Promise<SiteContentRecord> {
    const key = (input.key ?? '').trim();
    if (!key) {
      throw new AppError('A content key is required', 400);
    }
    if (input.data === undefined || input.data === null) {
      throw new AppError('A data payload is required', 400);
    }

    // Preserve the existing type when the caller omits it, so a data-only edit
    // never silently retags the block.
    const existing = await this.siteContentRepo.getByKey(key);
    const type = (input.type ?? existing?.type ?? 'custom').trim() || 'custom';

    return this.siteContentRepo.upsert(key, type, input.data, input.updatedBy);
  }
}
