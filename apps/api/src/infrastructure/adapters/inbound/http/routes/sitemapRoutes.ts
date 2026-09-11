import { Router } from 'express';
import { CampaignModel } from '../../../../database/models/CampaignModel.js';
import { CreatorProfileModel } from '../../../../database/models/CreatorProfileModel.js';
import { logger } from '../../../../logging/logger.js';

/**
 * The sitemap for app.ujimora.com.
 *
 * Campaigns are the product's long-tail search surface and they change
 * constantly, so this cannot be a file checked into the repo the way the
 * marketing sitemap is — it is generated per request from what is actually
 * publishable right now.
 *
 * Served by the API and exposed at https://app.ujimora.com/sitemap.xml through a
 * rewrite in vercel.json, because a sitemap may only list URLs on the host that
 * serves it.
 */

/** Sitemaps allow 50,000 URLs; stay well under and leave room for static routes. */
const MAX_CAMPAIGNS = 20_000;
const MAX_CREATORS = 5_000;

/**
 * Only campaigns a visitor may actually open. Draft, pending-review and blocked
 * campaigns render behind guards, and listing them would invite crawlers to
 * pages that answer with nothing — soft 404s that cost crawl budget.
 */
const INDEXABLE_STATUSES = ['active', 'funded'];

const APP_ORIGIN = 'https://app.ujimora.com';

/** Static public routes. Authenticated areas are excluded by robots.txt too. */
const STATIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/explore', changefreq: 'daily', priority: '0.9' },
  { path: '/organizations', changefreq: 'weekly', priority: '0.7' },
  { path: '/leaderboard', changefreq: 'daily', priority: '0.6' },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(path: string, lastmod?: Date, changefreq = 'weekly', priority = '0.5'): string {
  const mod = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
  return `<url><loc>${escapeXml(APP_ORIGIN + path)}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export function createSitemapRoutes(): Router {
  const router = Router();

  router.get('/sitemap.xml', async (_req, res) => {
    try {
      const [campaigns, creators] = await Promise.all([
        CampaignModel.find({ deletedAt: { $exists: false }, status: { $in: INDEXABLE_STATUSES } })
          .select('slug updatedAt')
          .sort({ updatedAt: -1 })
          .limit(MAX_CAMPAIGNS)
          .lean(),
        CreatorProfileModel.find({})
          .select('handle updatedAt')
          .sort({ updatedAt: -1 })
          .limit(MAX_CREATORS)
          .lean(),
      ]);

      const entries = [
        ...STATIC_ROUTES.map((r) => urlEntry(r.path, undefined, r.changefreq, r.priority)),
        // `/c/:slug` is the canonical campaign URL the pages themselves declare;
        // listing the id form instead would point crawlers at URLs that
        // canonicalise elsewhere. A campaign without a slug is skipped rather
        // than listed under a shape that contradicts its own canonical.
        ...campaigns
          .filter((c) => typeof c.slug === 'string' && c.slug.length > 0)
          .map((c) => urlEntry(`/c/${c.slug}`, c.updatedAt, 'daily', '0.8')),
        ...creators
          .filter((c) => typeof c.handle === 'string' && c.handle.length > 0)
          .map((c) => urlEntry(`/creators/${c.handle}`, c.updatedAt, 'weekly', '0.6')),
      ];

      res.type('application/xml');
      // Crawlers refetch often; an hour keeps new campaigns discoverable quickly
      // without querying on every hit.
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
      );
    } catch (error) {
      logger.error({ error }, 'sitemap generation failed');
      // A 500 tells the crawler to retry rather than to treat the sitemap as
      // empty, which is what an empty 200 would mean.
      res.sendStatus(500);
    }
  });

  /**
   * api.ujimora.com has no robots.txt, so crawlers get the API's JSON 404 for
   * it and fall back to assuming the whole host is fair game.
   *
   * Deliberately NOT `Disallow: /`. The browser calls /api/v1 on its own
   * origin and Vercel rewrites it here, so blocking this host would be
   * harmless today — but the moment anyone points VITE_API_URL at the absolute
   * origin, a blanket Disallow stops Googlebot fetching the data the SPA needs
   * to render, and every campaign page renders empty. Disallow controls
   * FETCHING; the thing actually wanted here is "fetch freely, index nothing",
   * which is what the X-Robots-Tag header on API responses says.
   *
   * What is blocked is only what no crawler should ever walk: callbacks and
   * webhook endpoints, which carry provider references in their URLs.
   */
  router.get('/robots.txt', (_req, res) => {
    res.type('text/plain');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/v1/webhooks/',
        'Disallow: /api/v1/payouts/paystack-approval',
        '',
      ].join('\n')
    );
  });

  return router;
}
