import { Router } from 'express';
import { logger } from '../../../../logging/logger.js';
import type { PublicProfileVisibilityPort } from '../../../../../domain/ports/outbound/PublicProfileVisibilityPort.js';
import type { OrganizationRepositoryPort } from '../../../../../domain/ports/outbound/OrganizationRepositoryPort.js';
import { appPublicPages } from '../../../../seo/publicPages.js';

/**
 * The sitemap for app.ujimora.com.
 *
 * Campaigns are the product's long-tail search surface and they change
 * constantly, so this cannot be a file checked into the repo the way the
 * marketing sitemap is — it is generated per request from what is actually
 * publishable right now (seo/publicPages.ts, which IndexNow reads too).
 *
 * Served by the API and exposed at https://app.ujimora.com/sitemap.xml through a
 * rewrite in vercel.json, because a sitemap may only list URLs on the host that
 * serves it.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(url: string, lastmod: Date | undefined, changefreq: string, priority: string): string {
  const mod = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '';
  return `<url><loc>${escapeXml(url)}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export function createSitemapRoutes(
  visibility: Pick<PublicProfileVisibilityPort, 'hiddenContentAuthorIds' | 'hiddenUserIds'>,
  organizations: Pick<OrganizationRepositoryPort, 'findAll'>,
): Router {
  const router = Router();

  router.get('/sitemap.xml', async (_req, res) => {
    try {
      const entries = (await appPublicPages(visibility, organizations)).map((page) =>
        urlEntry(page.url, page.lastmod, page.changefreq, page.priority));

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
