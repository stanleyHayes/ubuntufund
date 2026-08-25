import { randomBytes } from 'node:crypto';

/**
 * Slugs the platform reserves for its own routes / brand paths. A campaign can
 * never take one of these as a vanity handle (case-insensitive).
 */
export const RESERVED_SLUGS = new Set<string>([
  'api',
  'admin',
  'www',
  'app',
  'r',
  'qr',
  'live',
  'c',
  'u',
  'campaign',
  'campaigns',
  'about',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'help',
  'blog',
  'contact',
  'pricing',
  'terms',
  'privacy',
  'refund',
  'refunds',
  'dashboard',
  'settings',
  'profile',
  'search',
  'donate',
  'organizations',
  'organization',
  'org',
  'new',
  'edit',
  'static',
  'assets',
  'public',
  'health',
]);

const MAX_SLUG_LENGTH = 60;
const MIN_SLUG_LENGTH = 3;

/** Vanity slug shape: lowercase ascii words joined by single hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Normalize arbitrary text to a kebab-case ascii slug: strip diacritics, lower
 * case, collapse every run of non-alphanumerics to a single hyphen, and trim.
 * Returns '' when nothing usable survives.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // drop combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-ascii-alnum runs -> hyphen
    .replace(/-{2,}/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, '') // trim edge hyphens
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, ''); // re-trim in case the slice landed on a hyphen
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** True when `slug` is a syntactically valid, non-reserved vanity handle. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= MIN_SLUG_LENGTH &&
    slug.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(slug) &&
    !isReservedSlug(slug)
  );
}

function shortSuffix(length = 4): string {
  // base36 alphabet [0-9a-z]; drop the leading '0.' from toString(36).
  let out = '';
  while (out.length < length) {
    out += randomBytes(4).readUInt32BE(0).toString(36);
  }
  return out.slice(0, length);
}

/**
 * Build a unique, non-reserved slug from a base string (usually the title),
 * deduping against `exists` by appending a short random suffix on collision.
 * `exists(slug)` should resolve true when the slug is already taken.
 */
export async function generateUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let root = slugify(base);
  if (root.length < MIN_SLUG_LENGTH) {
    // Titles that slug to nothing usable (emoji-only, too short, etc.) still
    // deserve a stable, valid handle.
    root = `campaign-${shortSuffix(6)}`;
  }
  // Reserve the trailing room so `root-suffix` never exceeds MAX_SLUG_LENGTH.
  const rootCap = MAX_SLUG_LENGTH - 5;
  if (root.length > rootCap) {
    root = root.slice(0, rootCap).replace(/-+$/g, '');
  }

  let candidate = root;
  if (isReservedSlug(candidate)) {
    candidate = `${root}-${shortSuffix()}`;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    if (!isReservedSlug(candidate) && !(await exists(candidate))) {
      return candidate;
    }
    candidate = `${root}-${shortSuffix()}`;
  }

  // Extremely unlikely fall-through: a longer suffix all but guarantees uniqueness.
  return `${root}-${shortSuffix(8)}`;
}
