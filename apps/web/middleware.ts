/**
 * Vercel Routing Middleware: per-campaign link previews.
 *
 * Link-preview scrapers read raw HTML and never run the SPA, so every shared
 * campaign link showed the generic Ujimora card. For those scrapers only, this
 * serves index.html with the campaign's title, story and cover in the share
 * tags. People (and Googlebot, which renders JavaScript) are untouched: the
 * middleware returns nothing and the request continues as before.
 *
 * It never blocks a page. Any failure — slow or failing API, a campaign that is
 * not public, a missing index.html — also returns nothing, so the scraper gets
 * the normal static card. Only public campaigns resolve: the API endpoint used
 * here applies the same visibility check as the public page.
 */
import { campaignKeyFromPath, campaignShareMeta, injectShareMeta, isLinkPreviewBot } from './src/lib/shareMeta'

export const config = {
  matcher: ['/c/:slug', '/c/:slug/donate', '/campaigns/:id'],
}

// Same API origin the /api/v1 rewrite in vercel.json targets.
const API_ORIGIN = 'https://api.ujimora.com'
const TIMEOUT_MS = 1500

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET' || !isLinkPreviewBot(request.headers.get('user-agent'))) return undefined
  const url = new URL(request.url)
  const key = campaignKeyFromPath(url.pathname)
  if (!key) return undefined
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS)
    const [campaignResponse, pageResponse] = await Promise.all([
      fetch(`${API_ORIGIN}/api/v1/campaigns/slug/${encodeURIComponent(key)}/public`, { headers: { accept: 'application/json' }, signal }),
      fetch(new URL('/index.html', url), { signal }),
    ])
    if (!campaignResponse.ok || !pageResponse.ok) return undefined
    const campaign = (await campaignResponse.json() as { data?: Parameters<typeof campaignShareMeta>[0] }).data
    const html = await pageResponse.text()
    if (!campaign?.id || !campaign.title || !/<head>/i.test(html)) return undefined
    return new Response(injectShareMeta(html, campaignShareMeta(campaign, url.origin)), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
        vary: 'user-agent',
      },
    })
  } catch {
    return undefined
  }
}
