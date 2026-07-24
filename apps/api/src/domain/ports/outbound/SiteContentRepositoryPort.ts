/**
 * A single headless-CMS content block: a stable `key` mapping to an arbitrary
 * JSON `data` payload. The `type` tag lets consumers (admin editor, marketing
 * site) know how to render/validate the payload without hard-coding per-key
 * logic.
 */
export interface SiteContentRecord {
  key: string;
  type: string;
  data: unknown;
  updatedAt: Date;
  updatedBy?: string;
}

export interface SiteContentRepositoryPort {
  /**
   * Fetches a single content block by its stable key, or `null` when the key
   * has never been written. Callers (public marketing reads) must treat the
   * null case as "not found" rather than crashing.
   */
  getByKey(key: string): Promise<SiteContentRecord | null>;

  /** Lists every content block, ordered by `key` for a stable admin listing. */
  list(): Promise<SiteContentRecord[]>;

  /**
   * Creates or replaces the block at `key` (unique). `data` is stored verbatim
   * as arbitrary JSON; `updatedBy` records the admin user id when known.
   */
  upsert(
    key: string,
    type: string,
    data: unknown,
    updatedBy?: string
  ): Promise<SiteContentRecord>;

  /**
   * Number of stored blocks. Used by the boot seed to decide whether to
   * populate first-run defaults (only when the collection is empty).
   */
  count(): Promise<number>;
}
