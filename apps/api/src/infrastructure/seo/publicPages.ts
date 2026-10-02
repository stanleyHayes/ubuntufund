import { CampaignModel } from '../database/models/CampaignModel.js';
import { CreatorProfileModel } from '../database/models/CreatorProfileModel.js';
import { BlogPostModel } from '../database/models/BlogPostModel.js';
import type { PublicProfileVisibilityPort } from '../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { OrganizationRepositoryPort } from '../../domain/ports/outbound/OrganizationRepositoryPort.js';
import { deriveOrganizationSlug, type OrganizationRecord } from '../../domain/entities/Organization.js';

/**
 * The public pages search engines should know about, and when each last
 * changed. Two readers: the sitemaps (sitemapRoutes.ts, blogRoutes.ts) and the
 * IndexNow notifier (indexNow.ts), which tells search engines about changes as
 * they happen. Keeping one list means a page is never announced to one and
 * hidden from the other.
 */

export const APP_ORIGIN = 'https://app.ujimora.com';
export const MARKETING_ORIGIN = 'https://ujimora.com';

export interface PublicPage {
  /** Absolute URL. */
  url: string;
  lastmod?: Date;
  changefreq: string;
  priority: string;
}

/** Sitemaps allow 50,000 URLs; stay well under and leave room for static routes. */
const MAX_CAMPAIGNS = 20_000;
const MAX_CREATORS = 5_000;
const MAX_ORGANIZATIONS = 5_000;
const MAX_BLOG_POSTS = 45_000;

/**
 * Only campaigns a visitor may actually open. Draft, pending-review and blocked
 * campaigns render behind guards, and listing them would invite crawlers to
 * pages that answer with nothing — soft 404s that cost crawl budget.
 *
 * Only open campaigns are advertised: one whose end date has passed is closed
 * even before the expiry sweep re-labels it, and daily/0.8 would misstate it.
 */
const INDEXABLE_STATUSES = ['active', 'funded'];

/** Static public routes. Authenticated areas are excluded by robots.txt too. */
const STATIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/explore', changefreq: 'daily', priority: '0.9' },
  { path: '/organizations', changefreq: 'weekly', priority: '0.7' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.6' },
];

/**
 * The organization profile URLs a visitor can open, one per slug.
 *
 * Mirrors GET /organizations/:slug: a slug derives from the name, a name two
 * organizations share resolves to the older one (MongoOrganizationRepository.
 * findBySlugOrId), and that profile answers 404 when the account is hidden. So
 * each slug is listed once, and only when its oldest organization is visible.
 */
export function organizationEntries(all: OrganizationRecord[], hidden: Set<string>): OrganizationRecord[] {
  const owner = new Map<string, OrganizationRecord>();
  for (const org of all) {
    const slug = deriveOrganizationSlug(org.name);
    if (!slug) continue;
    const current = owner.get(slug);
    const older = !current || org.createdAt.getTime() < current.createdAt.getTime()
      || (org.createdAt.getTime() === current.createdAt.getTime() && org.id.localeCompare(current.id) < 0);
    if (older) owner.set(slug, org);
  }
  return [...owner.values()].filter((org) => !hidden.has(org.id));
}

/**
 * Every public page of app.ujimora.com: static routes, open campaigns, creator
 * pages and organization profiles. `visibility` drops creators and
 * organizations whose public page answers 404 (deleted accounts and
 * publishing-restricted users): listing them would send crawlers to dead URLs
 * and publicly enumerate restricted accounts.
 */
export async function appPublicPages(
  visibility: Pick<PublicProfileVisibilityPort, 'hiddenContentAuthorIds' | 'hiddenUserIds'>,
  organizations: Pick<OrganizationRepositoryPort, 'findAll'>,
): Promise<PublicPage[]> {
  const [campaigns, creators, organizationRecords] = await Promise.all([
    CampaignModel.find({ deletedAt: { $exists: false }, status: { $in: INDEXABLE_STATUSES }, endDate: { $gt: new Date() } })
      .select('slug updatedAt')
      .sort({ updatedAt: -1 })
      .limit(MAX_CAMPAIGNS)
      .lean(),
    CreatorProfileModel.find({})
      .select('handle updatedAt userId')
      .sort({ updatedAt: -1 })
      .limit(MAX_CREATORS)
      .lean(),
    organizations.findAll(),
  ]);
  // No viewer: the same check the public pages apply to a signed-out visitor.
  const hiddenCreators = await visibility.hiddenContentAuthorIds(creators.map((c) => String(c.userId)));
  const hiddenOrganizations = await visibility.hiddenUserIds(organizationRecords.map((org) => org.id));
  const listedOrganizations = organizationEntries(organizationRecords, hiddenOrganizations)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, MAX_ORGANIZATIONS);

  return [
    ...STATIC_ROUTES.map((route) => ({ url: `${APP_ORIGIN}${route.path}`, changefreq: route.changefreq, priority: route.priority })),
    // `/c/:slug` is the canonical campaign URL the pages themselves declare;
    // listing the id form instead would point crawlers at URLs that
    // canonicalise elsewhere. A campaign without a slug is skipped rather
    // than listed under a shape that contradicts its own canonical.
    ...campaigns
      .filter((c) => typeof c.slug === 'string' && c.slug.length > 0)
      .map((c) => ({ url: `${APP_ORIGIN}/c/${c.slug}`, lastmod: c.updatedAt, changefreq: 'daily', priority: '0.8' })),
    ...creators
      .filter((c) => typeof c.handle === 'string' && c.handle.length > 0 && !hiddenCreators.has(String(c.userId)))
      .map((c) => ({ url: `${APP_ORIGIN}/creators/${c.handle}`, lastmod: c.updatedAt, changefreq: 'weekly', priority: '0.6' })),
    ...listedOrganizations.map((org) => ({
      url: `${APP_ORIGIN}/organizations/${encodeURIComponent(deriveOrganizationSlug(org.name))}`,
      lastmod: org.updatedAt,
      changefreq: 'weekly',
      priority: '0.7',
    })),
  ];
}

/** Every published post on ujimora.com/blog, dated by its last published content change. */
export async function blogPublicPages(): Promise<{ url: string; lastmod: Date }[]> {
  const posts = await BlogPostModel.find({ publishedSlug: { $exists: true } })
    .select('publishedSlug publishedContentAt publishedAt updatedAt')
    .sort({ publishedAt: -1 })
    .limit(MAX_BLOG_POSTS)
    .lean();
  return posts.map((post) => ({
    url: `${MARKETING_ORIGIN}/blog/${encodeURIComponent(post.publishedSlug!)}`,
    lastmod: post.publishedContentAt ?? post.publishedAt ?? post.updatedAt,
  }));
}
