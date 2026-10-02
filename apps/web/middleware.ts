/**
 * Vercel Routing Middleware: crawler-ready public pages and link previews.
 *
 * The app is a single-page app, so the HTML for every URL is the same empty
 * shell until JavaScript runs. Two kinds of visitor never get further:
 *
 *   Search engines and AI crawlers (Google on its first pass, Bing, ChatGPT,
 *   Claude, Perplexity…) get the page's own head and the record's text in the
 *   HTML for campaigns, organizations and creators (src/lib/crawlerPages.ts).
 *   A record the API says does not exist answers 404, and old campaign
 *   addresses redirect (301) to the current one.
 *
 *   Link-preview scrapers (WhatsApp, Facebook, LinkedIn, Slack, X, Telegram,
 *   Discord) get index.html with the campaign's title, story and cover in the
 *   share tags (src/lib/shareMeta.ts).
 *
 * People are untouched: the middleware returns nothing and the request
 * continues as before. It never blocks a page either: a slow or failing API, or
 * a missing index.html, also returns nothing, so the visitor gets the normal app.
 *
 * Vercel runs this file as a Node.js ES module, where a relative import must
 * name its file (.js). The helpers are loaded inside the try so that even a
 * module that fails to load costs the crawler page, never the page itself.
 */

export const config = {
  matcher: ['/c/:slug', '/c/:slug/donate', '/campaigns/:id', '/organizations/:slug', '/creators/:handle'],
}

// Same API origin the /api/v1 rewrite in vercel.json targets.
const API_ORIGIN = 'https://api.ujimora.com'
const TIMEOUT_MS = 1500
/** Crawlers wait longer than people, and a complete page is worth the wait. */
const CRAWLER_TIMEOUT_MS = 2500

const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'

type CrawlerPages = typeof import('./src/lib/crawlerPages.js')

async function crawlerPage(request: Request, pages: CrawlerPages): Promise<Response | undefined> {
  const url = new URL(request.url)
  const route = pages.crawlerRouteFromPath(url.pathname)
  if (!route) return undefined
  const signal = AbortSignal.timeout(CRAWLER_TIMEOUT_MS)
  const [recordResponse, pageResponse] = await Promise.all([
    fetch(`${API_ORIGIN}${pages.apiPathFor(route)}`, { headers: { accept: 'application/json' }, signal }),
    fetch(new URL('/index.html', url), { signal }),
  ])
  // Only a definite "not found" becomes a 404; any other API trouble leaves the page alone.
  if (!pageResponse.ok || (!recordResponse.ok && recordResponse.status !== 404)) return undefined
  const record = recordResponse.status === 404 ? null : ((await recordResponse.json()) as { data?: unknown }).data ?? null

  const extras: { campaigns?: { id: string; slug?: string; title: string }[] } = {}
  const orgId = route.kind === 'organization' && record && typeof (record as { id?: unknown }).id === 'string' ? (record as { id: string }).id : null
  if (orgId) {
    // The organization's campaigns, as links: optional, so a failure only drops the list.
    try {
      const response = await fetch(`${API_ORIGIN}/api/v1/organizations/${encodeURIComponent(orgId)}/campaigns`, { headers: { accept: 'application/json' }, signal })
      const list = response.ok ? ((await response.json()) as { data?: unknown }).data : null
      if (Array.isArray(list)) {
        extras.campaigns = list
          .filter((c): c is { id: string; slug?: string; title: string; status?: string } => !!c && typeof c.id === 'string' && typeof c.title === 'string' && !['draft', 'pending_review', 'blocked'].includes(String(c.status)))
          .slice(0, 50)
      }
    } catch { /* the page is complete without the list */ }
  }

  const html = await pageResponse.text()
  if (!/<div id="root"><\/div>/.test(html) || !/<head>/i.test(html)) return undefined
  const answer = pages.crawlerAnswer(html, route, record, extras)
  const headers = { 'cache-control': CACHE, vary: 'user-agent' }
  if (answer.location) return new Response(null, { status: answer.status, headers: { ...headers, location: new URL(answer.location, url).toString() } })
  return new Response(answer.html, { status: answer.status, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } })
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  if (request.method !== 'GET') return undefined
  try {
    const userAgent = request.headers.get('user-agent')
    const pages = await import('./src/lib/crawlerPages.js')
    if (pages.isSearchCrawler(userAgent)) return await crawlerPage(request, pages)

    const { campaignKeyFromPath, campaignShareMeta, injectShareMeta, isLinkPreviewBot } = await import('./src/lib/shareMeta.js')
    if (!isLinkPreviewBot(userAgent)) return undefined
    const url = new URL(request.url)
    const key = campaignKeyFromPath(url.pathname)
    if (!key) return undefined
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
        'cache-control': CACHE,
        vary: 'user-agent',
      },
    })
  } catch (error) {
    // A slow API just means the plain page. Anything else, such as a helper
    // module that failed to load, belongs in the function logs.
    const timedOut = (error as { name?: unknown } | null)?.name === 'TimeoutError'
    // eslint-disable-next-line no-console -- Vercel's function logs are the middleware's only log sink.
    if (!timedOut) console.error('Crawler middleware fell back to the plain page:', error)
    return undefined
  }
}
