import type { SiteContentRepositoryPort } from '../../domain/ports/outbound/SiteContentRepositoryPort.js';
import { logger } from '../logging/logger.js';
import siteContentDefaultsJson from './siteContentDefaults.json';

export interface SiteContentDefault {
  key: string;
  type: string;
  data: unknown;
}

/**
 * The canonical first-run content, copied from the marketing site's hardcoded
 * values. Sourced from `siteContentDefaults.json` — the single source of truth
 * shared with `scripts/seed-dev.mjs` so the boot seed and the dev seed never
 * drift.
 */
export function loadSiteContentDefaults(): SiteContentDefault[] {
  return siteContentDefaultsJson as unknown as SiteContentDefault[];
}

/**
 * Populate the content collection with defaults ONLY when it is empty. Safe to
 * call on every boot (including production first-run): once any block exists —
 * seeded or admin-authored — this is a no-op and never overwrites edits.
 * Returns the number of blocks seeded (0 when the collection was non-empty).
 */
export async function seedSiteContentIfEmpty(
  repo: SiteContentRepositoryPort
): Promise<number> {
  const existing = await repo.count();
  if (existing > 0) return 0;

  const defaults = loadSiteContentDefaults();
  for (const block of defaults) {
    await repo.upsert(block.key, block.type, block.data);
  }
  logger.info(`Seeded ${defaults.length} site content blocks (collection was empty)`);
  return defaults.length;
}
