import type { SiteContentRepositoryPort } from '../../domain/ports/outbound/SiteContentRepositoryPort.js';
import { logger } from '../logging/logger.js';
import siteContentDefaultsJson from './siteContentDefaults.json';
import { SUPERSEDED_FAQ_DEFAULTS } from './supersededFaqDefaults.js';

interface SiteContentDefault {
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
function loadSiteContentDefaults(): SiteContentDefault[] {
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

interface FaqItem {
  category: string;
  question: string;
  answer: string;
}

function isFaqItem(value: unknown): value is FaqItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.category === 'string' && typeof item.question === 'string' && typeof item.answer === 'string';
}

const faqKey = (question: string, answer: string) => `${question}\u0000${answer}`;

/** Written as `updatedBy` so the CMS shows the FAQ was last changed by this refresh. */
export const FAQ_REFRESH_ACTOR = 'system:faq-defaults-refresh';

/**
 * Brings an existing deployment's FAQ up to date with corrected defaults
 * without touching anything an admin wrote. The boot seed above fills only an
 * empty collection, so a deployment keeps the FAQ text of its first boot,
 * including answers later found to be false.
 *
 * An entry is changed only while its question and answer still match, word
 * for word, a default that an earlier release seeded (SUPERSEDED_FAQ_DEFAULTS).
 * It then takes the current default's question and answer and keeps its own
 * category and position. An entry whose feature no longer exists is removed,
 * and so is one whose replacement question the FAQ already answers. Edited,
 * added and current entries are left exactly as they are.
 *
 * Safe on every boot: once nothing matches, it writes nothing. The write only
 * applies if the block is unchanged since it was read, so a concurrent admin
 * save wins and the refresh is retried on the next boot.
 */
export async function refreshSupersededFaqDefaults(
  repo: SiteContentRepositoryPort
): Promise<{ replaced: number; removed: number }> {
  const none = { replaced: 0, removed: 0 };
  const record = await repo.getByKey('faq');
  const data = record?.data;
  if (!record || !data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) return none;
  const items = (data as { items: unknown[] }).items;

  const defaults = loadSiteContentDefaults().find((block) => block.key === 'faq')?.data as { items?: unknown[] } | undefined;
  const current = new Map((defaults?.items ?? []).filter(isFaqItem).map((item) => [item.question, item]));
  const superseded = new Map(SUPERSEDED_FAQ_DEFAULTS.map((entry) => [faqKey(entry.question, entry.answer), entry]));
  const supersededEntry = (item: unknown) => (isFaqItem(item) ? superseded.get(faqKey(item.question, item.answer)) : undefined);

  // Questions the FAQ already answers with text this refresh does not own.
  const answered = new Set(items.filter((item) => isFaqItem(item) && !supersededEntry(item)).map((item) => (item as FaqItem).question));
  let replaced = 0;
  let removed = 0;
  const next: unknown[] = [];
  for (const item of items) {
    const entry = supersededEntry(item);
    if (!entry) {
      next.push(item);
      continue;
    }
    if (entry.current === null) {
      removed += 1;
      continue;
    }
    const replacement = current.get(entry.current);
    if (!replacement) {
      // The list names a default that no longer exists: leave the entry for an admin.
      next.push(item);
      continue;
    }
    if (answered.has(replacement.question)) {
      removed += 1;
      continue;
    }
    next.push({ ...(item as FaqItem), question: replacement.question, answer: replacement.answer });
    answered.add(replacement.question);
    replaced += 1;
  }
  if (!replaced && !removed) return none;

  const saved = await repo.replaceIfUnchanged('faq', record.type, { ...(data as object), items: next }, record.updatedAt, FAQ_REFRESH_ACTOR);
  if (!saved) {
    logger.warn('FAQ changed while superseded default answers were being replaced; retrying on the next boot');
    return none;
  }
  logger.info({ replaced, removed }, 'Replaced superseded default FAQ answers');
  return { replaced, removed };
}
