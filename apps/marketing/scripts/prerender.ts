import fs from 'node:fs/promises'
import path from 'node:path'
import type { Logger, Plugin } from 'vite'
import { GUIDE_HEADS, POLICY_HEADS, SITE_ORIGIN, STATIC_PATHS, blogPostHead, pageHead, type PageHead } from '../src/lib/pageSeo.ts'
import { GUIDE_GROUPS, GUIDES, GUIDES_INDEX } from '../src/data/guides.ts'
import { PRERENDER_DATA_ID, serializeForScript, type PrerenderData } from '../src/lib/embeddedData.ts'
import type { RenderedPage, render as renderPage } from '../src/entry-server.tsx'

/**
 * Prerenders every public route to a complete HTML page at build time.
 *
 * The site is a single-page app, and it used to ship one empty
 * `<div id="root">` for every URL: the words of each page existed only after
 * JavaScript ran. Google renders JavaScript on a delay; Bing does so
 * unreliably; AI answer engines and link-preview scrapers do not at all. So
 * this step renders each route with React on the server (src/entry-server.tsx)
 * and writes `dist/<route>/index.html` with the page's own head, its content,
 * the CSS that content needs, and the API data it was rendered with. The
 * browser then adopts that HTML instead of drawing the page again (main.tsx).
 *
 * The head comes from the page itself: whatever it passes to `useSeo` (title,
 * description, canonical, robots, JSON-LD) is collected during the render, so
 * the HTML and the browser can never disagree about it.
 *
 * Vercel serves a real file before applying a rewrite, so /about gets
 * dist/about/index.html. Two other files cover everything else:
 *   app-shell.html  for /blog/:slug posts published after the build (the only
 *                   rewrite left in vercel.json); it carries no canonical and
 *                   renders in the browser as before
 *   404.html        Vercel's not-found page, served with HTTP 404 for any other
 *                   unknown URL, instead of the 200 that made every typo an
 *                   indexable "soft 404"
 */

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (value: string) => escapeText(value).replace(/"/g, '&quot;')

function replaceOnce(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: index.html has no ${label}; update the template or this build step`)
  // A function replacement keeps `$` in page copy from being read as a group reference.
  return html.replace(pattern, (_, before: string, after: string) => `${before}${replacement}${after}`)
}

function insertBefore(html: string, marker: string, content: string): string {
  const at = html.indexOf(marker)
  if (at === -1) throw new Error(`prerender: index.html has no ${marker}`)
  return `${html.slice(0, at)}${content}${html.slice(at)}`
}

const META = (attr: 'name' | 'property', key: string) => new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
const CANONICAL = /(<link rel="canonical" href=")[^"]*(")/
const TITLE = /(<title>)[^<]*(<\/title>)/
const ROOT = /(<div id="root">)(<\/div>)/
/** The id useSeo replaces on navigation (packages/ui/src/seo.ts). */
const JSONLD_ID = 'route-jsonld'

/** Title, description, robots and share tags; the canonical and page URL are left to the caller. */
function renderHeadTags(template: string, head: PageHead, url: string | null): string {
  let html = replaceOnce(template, TITLE, escapeText(head.title), '<title>')
  const metas: ['name' | 'property', string, string][] = [
    ['name', 'title', head.title],
    ['name', 'description', head.description],
    ['property', 'og:type', head.type ?? 'website'],
    ['property', 'og:title', head.title],
    ['property', 'og:description', head.description],
    ['name', 'twitter:title', head.title],
    ['name', 'twitter:description', head.description],
  ]
  if (url) metas.push(['property', 'og:url', url], ['name', 'twitter:url', url])
  if (head.robots) metas.push(['name', 'robots', head.robots])
  for (const [attr, key, value] of metas) html = replaceOnce(html, META(attr, key), escapeAttr(value), `${key} meta tag`)
  if (head.image) {
    // The template's size and type describe the default 1200x630 card, not this image.
    html = html.replace(/\s*<meta property="og:image:(?:type|width|height)" content="[^"]*" \/>/g, '')
    for (const [attr, key, value] of [
      ['property', 'og:image', head.image],
      ['name', 'twitter:image', head.image],
      ['property', 'og:image:alt', head.imageAlt ?? head.title],
      ['name', 'twitter:image:alt', head.imageAlt ?? head.title],
    ] as const) html = replaceOnce(html, META(attr, key), escapeAttr(value), `${key} meta tag`)
  }
  if (head.jsonLd) {
    html = insertBefore(html, '</head>', `  <script type="application/ld+json" id="${JSONLD_ID}">${serializeForScript(head.jsonLd)}</script>\n  `)
  }
  return html
}

/** The page URL a route head declares: its own path on the marketing origin. */
export function pageUrl(head: Pick<PageHead, 'path'>): string {
  return `${SITE_ORIGIN}${head.path === '/' ? '/' : head.path}`
}

/** A route's HTML head: its own title, description, robots, share tags, canonical and JSON-LD. */
export function renderRouteHtml(template: string, head: PageHead): string {
  const url = pageUrl(head)
  const html = renderHeadTags(template, head, url)
  return replaceOnce(html, CANONICAL, escapeAttr(head.canonicalUrl ?? url), 'canonical link')
}

/** The rewrite fallback: no canonical or page URL, so it never claims another page. */
export function renderShellHtml(template: string): string {
  const html = template
    .replace(/\s*<!-- Canonical -->/, '')
    .replace(/\s*<link rel="canonical"[^>]*>/, '')
    .replace(/\s*<meta property="og:url"[^>]*>/, '')
    .replace(/\s*<meta name="twitter:url"[^>]*>/, '')
  if (CANONICAL.test(html)) throw new Error('prerender: app-shell.html still has a canonical link')
  return html
}

/** Put a rendered page's markup, styles and data into an HTML document whose head is already set. */
export function fillPage(html: string, page: Pick<RenderedPage, 'html' | 'styles' | 'data'>): string {
  let out = insertBefore(html, '</head>', `${page.styles}\n  `)
  const data = Object.keys(page.data).length
    ? `<script type="application/json" id="${PRERENDER_DATA_ID}">${serializeForScript(page.data)}</script>`
    : ''
  out = replaceOnce(out, ROOT, page.html, 'empty <div id="root"></div>')
  return data ? out.replace('<div id="root">', () => `${data}<div id="root">`) : out
}

/** The full page for a route. */
export function renderPageHtml(template: string, head: PageHead, page: Pick<RenderedPage, 'html' | 'styles' | 'data'>): string {
  return fillPage(renderRouteHtml(template, head), page)
}

/** Vercel's not-found page: served for every unknown URL, so it names none and asks not to be indexed. */
export function renderNotFoundHtml(template: string, head: PageHead, page: Pick<RenderedPage, 'html' | 'styles' | 'data'>): string {
  const html = renderHeadTags(renderShellHtml(template), { ...head, robots: 'noindex, follow', jsonLd: undefined }, null)
  return fillPage(html, page)
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

interface BlogPostSource { slug: string; title: string; excerpt: string }

/**
 * Data the pages read from the API, fetched once per build. Only on Vercel
 * builds (or PRERENDER_DATA=1), so local and CI builds stay offline and render
 * each page's own fallback. A failed request never fails the build: the pages
 * that needed it render their loading state and fetch in the browser.
 */
export async function fetchPrerenderData(logger: Pick<Logger, 'warn'>): Promise<{ data: PrerenderData; posts: BlogPostSource[] }> {
  const enabled = process.env.VERCEL === '1' || process.env.PRERENDER_DATA === '1' || process.env.PRERENDER_BLOG === '1'
  if (!enabled) return { data: {}, posts: [] }
  const api = process.env.PRERENDER_API_URL ?? 'https://api.ujimora.com/api/v1'
  const get = async (resource: string): Promise<unknown> => {
    const response = await fetch(`${api}${resource}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`${resource}: HTTP ${response.status}`)
    return ((await response.json()) as { data?: unknown }).data
  }
  const data: Record<string, unknown> = {}
  let posts: BlogPostSource[] = []
  const [content, blog, plans, testimonials] = await Promise.allSettled([get('/content'), get('/blog'), get('/plans/public'), get('/testimonials')])

  if (content.status === 'fulfilled' && Array.isArray(content.value)) {
    for (const block of content.value as { key?: unknown; data?: unknown }[]) {
      if (typeof block.key === 'string' && block.data != null) data[`content:${block.key}`] = block.data
    }
  }
  if (blog.status === 'fulfilled' && Array.isArray(blog.value)) {
    // Slugs become directory names, so anything unexpected is skipped, not written.
    const valid = (blog.value as Record<string, unknown>[]).filter((post): post is Record<string, unknown> & BlogPostSource =>
      typeof post.slug === 'string' && SLUG.test(post.slug) && typeof post.title === 'string' && typeof post.excerpt === 'string')
    data.blog = valid
    for (const post of valid) data[`blog:${post.slug}`] = post
    posts = valid
  }
  if (plans.status === 'fulfilled' && Array.isArray(plans.value) && plans.value.length) data.plans = plans.value
  if (testimonials.status === 'fulfilled' && Array.isArray(testimonials.value)) data.testimonials = testimonials.value

  for (const [name, result] of Object.entries({ content, blog, plans, testimonials })) {
    if (result.status === 'rejected') logger.warn(`prerender: ${name} not fetched (${result.reason instanceof Error ? result.reason.message : String(result.reason)}); its pages render their fallback`)
  }
  return { data, posts }
}

/** Every route the build writes a page for. */
export function routeHeads(posts: BlogPostSource[] = []): PageHead[] {
  return [...STATIC_PATHS.map(pageHead), ...GUIDE_HEADS, ...POLICY_HEADS, ...posts.map(blogPostHead)]
}

/**
 * The head a rendered page declared, checked against the route it was rendered
 * for. A page that names another path as itself would hand Google a wrong
 * canonical, so the build stops instead.
 */
export function headFor(route: PageHead, rendered: RenderedPage): PageHead {
  const head = rendered.head ?? route
  if (head.path !== route.path) {
    throw new Error(`prerender: ${route.path} rendered a head for ${head.path}; check that page's useSeo call`)
  }
  return head
}

const SITE_JSONLD = /(<script type="application\/ld\+json" id="site-jsonld">)([\s\S]*?)(<\/script>)/

/**
 * The site-wide Organization node, with `sameAs` set to the social profiles the
 * owner entered in Admin → Content → Contact. Only those: a guessed profile URL
 * is a false identity claim. With none entered, the template is unchanged.
 */
export function withSocialProfiles(template: string, contact: unknown): string {
  const socials = (contact as { socials?: Record<string, unknown> } | null | undefined)?.socials ?? {}
  const urls = [...new Set(Object.values(socials).filter((value): value is string => typeof value === 'string' && /^https:\/\/[^\s"<>]+$/.test(value.trim())).map((value) => value.trim()))]
  if (!urls.length) return template
  const match = SITE_JSONLD.exec(template)
  if (!match) throw new Error('prerender: index.html has no site-jsonld script')
  const site = JSON.parse(match[2]) as { '@graph': { '@type': string; sameAs?: string[] }[] }
  const organization = site['@graph'].find((node) => node['@type'] === 'Organization')
  if (!organization) throw new Error('prerender: site-jsonld has no Organization node')
  organization.sameAs = urls
  return template.replace(SITE_JSONLD, (_, open: string, _json: string, close: string) => `${open}${serializeForScript(site)}${close}`)
}

/**
 * /llms.txt (llmstxt.org): a plain summary of the site and its key pages for AI
 * assistants and answer engines, which mostly read text rather than run apps.
 * Built from the same data as the pages, so it lists exactly what exists.
 */
export function renderLlmsTxt(): string {
  const url = (path: string) => `${SITE_ORIGIN}${path === '/' ? '/' : path}`
  const statics = STATIC_PATHS.map(pageHead)
  const page = (path: string) => statics.find((head) => head.path === path)!
  const line = (name: string, path: string, about: string) => `- [${name}](${url(path)}): ${about}`
  return [
    '# Ujimora',
    '',
    '> Ujimora is a crowdfunding platform for Ghana. People raise money for medical bills, school fees, funerals, churches, community projects and emergencies. Supporters give in Ghana cedis by mobile money (MTN MoMo, Telecel Cash, AT Money) or by debit or credit card, including many cards issued abroad. Organizers verify their identity before they can create a campaign, campaigns are screened before they go live, and payouts go to Ghanaian bank accounts or mobile money wallets after verification and reconciliation checks.',
    '',
    '- Operated by DevTrack, a business registered in Ghana (BN843072020), in Accra. Contact: info@ujimora.com; trust and safety reports: trust@ujimora.com.',
    '- Website: https://ujimora.com. Web app for campaigns and donations: https://app.ujimora.com.',
    '- Platform fee by plan: 5% on Free, 3.5% on Starter, 2% on Pro and Organization, 1% on Enterprise. Payment-processing charges are shown before anyone pays.',
    '- Donation-based fundraising only: no investment, loan or equity crowdfunding. Campaigns are not all-or-nothing.',
    '- Campaign creation is open to organizers based in Ghana; supporters can give from abroad by card.',
    '',
    ...GUIDE_GROUPS.flatMap((group) => [
      `## ${group.heading}`,
      '',
      ...GUIDES.filter((guide) => guide.group === group.id).map((guide) => line(guide.name, guide.path, guide.summary)),
      '',
    ]),
    '## The platform',
    '',
    line('Fundraising guides', GUIDES_INDEX.path, 'Every guide on one page.'),
    line('Pricing and plans', '/pricing', page('/pricing').description),
    line('Features', '/features', page('/features').description),
    line('For organizations', '/for-organizations', page('/for-organizations').description),
    line('Help center', '/help', page('/help').description),
    `- [Browse live campaigns](https://app.ujimora.com/explore): Campaigns currently accepting donations.`,
    '',
    '## Policies',
    '',
    ...POLICY_HEADS.map((head) => line(head.title.replace(/ \| Ujimora$/, ''), head.path, head.description)),
    '',
    '## Optional',
    '',
    line('About Ujimora', '/about', page('/about').description),
    line('Blog', '/blog', page('/blog').description),
    line('Contact', '/contact', page('/contact').description),
    '',
  ].join('\n')
}

/** Rendered at a path no route matches, so the catch-all not-found page renders. */
const NOT_FOUND_PROBE = '/__prerender-not-found__'

export function prerender(): Plugin {
  let root = ''
  let outDir = ''
  let configFile: string | undefined
  let mode = 'production'
  let logger: Logger
  return {
    name: 'ujimora-prerender',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = path.resolve(config.root, config.build.outDir)
      configFile = config.configFile
      mode = config.mode
      logger = config.logger
    },
    async writeBundle() {
      const { data, posts } = await fetchPrerenderData(logger)
      const template = withSocialProfiles(await fs.readFile(path.join(outDir, 'index.html'), 'utf8'), data['content:contact'])
      const { createServer } = await import('vite')
      // A server in middleware mode only to load the app for rendering: no port,
      // no file watching, no dependency pre-bundling. This plugin applies to
      // builds only, so loading the same config does not run it again.
      const server = await createServer({
        configFile,
        root,
        mode,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, ws: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      })
      try {
        const { render } = (await server.ssrLoadModule('/src/entry-server.tsx')) as { render: typeof renderPage }
        const routes = routeHeads(posts)
        let written = 0
        for (const route of routes) {
          const rendered = render(route.path, data)
          const head = headFor(route, rendered)
          if (head.robots?.includes('noindex')) {
            // A listed route that renders "not found" (say, a post whose data
            // failed to load) keeps the browser-rendered fallback instead.
            logger.warn(`prerender: ${route.path} rendered as noindex; leaving it to app-shell.html`)
            continue
          }
          const file = route.path === '/' ? path.join(outDir, 'index.html') : path.join(outDir, route.path.slice(1), 'index.html')
          await fs.mkdir(path.dirname(file), { recursive: true })
          await fs.writeFile(file, renderPageHtml(template, head, rendered))
          written++
        }
        const notFound = render(NOT_FOUND_PROBE, data)
        await fs.writeFile(path.join(outDir, '404.html'), renderNotFoundHtml(template, notFound.head ?? { title: 'Page not found | Ujimora', description: 'This page does not exist.', path: NOT_FOUND_PROBE }, notFound))
        await fs.writeFile(path.join(outDir, 'app-shell.html'), renderShellHtml(template))
        await fs.writeFile(path.join(outDir, 'llms.txt'), renderLlmsTxt())
        logger.info(`prerender: wrote ${written} pages, 404.html, app-shell.html and llms.txt`)
      } finally {
        await server.close()
      }
    },
  }
}
