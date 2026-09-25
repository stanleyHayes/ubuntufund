import { z } from 'zod';
import { AppError } from './errorHandler.js';

/** Largest page any list endpoint serves; the admin console's loadAll asks for exactly this. */
export const MAX_PAGE_SIZE = 100;

/** A whole number in [1, max], the fallback when omitted, or null when invalid. */
function wholeNumber(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined || value === '') return fallback;
  const parsed = z.coerce.number().int().min(1).max(max).safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Parse `?page=&pageSize=` for a public list. Omitted values take the defaults
 * (existing clients are unaffected); anything else must be a whole number in
 * range, so `pageSize=100000` cannot pull a whole collection and `page=-1`
 * cannot become a negative skip (which MongoDB rejects, surfacing as a 500).
 */
export function parsePagination(
  query: Record<string, unknown>,
  options: { defaultPageSize?: number; maxPageSize?: number } = {},
): { page: number; pageSize: number } {
  const max = options.maxPageSize ?? MAX_PAGE_SIZE;
  const page = wholeNumber(query.page, 1, 1_000_000);
  if (page === null) throw new AppError('Page must be a whole number of at least 1.', 400);
  const pageSize = wholeNumber(query.pageSize, options.defaultPageSize ?? 20, max);
  if (pageSize === null) throw new AppError(`Page size must be a whole number between 1 and ${max}.`, 400);
  return { page, pageSize };
}

/**
 * `?limit=&before=` for a newest-first feed (notifications). `before` is an
 * ISO timestamp cursor: the next page is everything older than the last item.
 */
export function parseFeedWindow(
  query: Record<string, unknown>,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): { limit: number; before?: Date } {
  const max = options.maxLimit ?? MAX_PAGE_SIZE;
  const limit = wholeNumber(query.limit, options.defaultLimit ?? 50, max);
  if (limit === null) throw new AppError(`Limit must be a whole number between 1 and ${max}.`, 400);
  if (query.before === undefined || query.before === '') return { limit };
  const before = typeof query.before === 'string' ? new Date(query.before) : new Date(NaN);
  if (Number.isNaN(before.getTime())) throw new AppError('before must be an ISO date.', 400);
  return { limit, before };
}
