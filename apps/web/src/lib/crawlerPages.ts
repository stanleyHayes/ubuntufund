/**
 * Crawler-ready pages for the app's public records (used by /middleware.ts).
 *
 * The app is a single-page app: every URL ships the same empty
 * `<div id="root">`, and a campaign's title, story and progress appear only
 * after JavaScript runs and the API answers. Google renders JavaScript on a
 * delay; Bing does so unreliably; AI answer engines (ChatGPT, Claude,
 * Perplexity) mostly do not run it at all. For those crawlers only, the
 * middleware returns index.html with:
 *   - the head the page itself declares once loaded (publicPageSeo.ts), and
 *   - the record's text as plain HTML inside #root.
 * The app script stays in the page, so a crawler that runs JavaScript gets the
 * same app a visitor does; React replaces the snapshot when it starts. The
 * snapshot only says what the page says, so search engines see the same
 * content as people.
 *
 * Plain string helpers with no React, DOM or package imports: Vercel loads them
 * as Node.js ES modules, where relative imports must name their .js file.
 */
import {
  APP_ORIGIN,
  campaignDonateSeo,
  campaignPath,
  campaignSeo,
  creatorSeo,
  organizationSeo,
  type CampaignSeoSource,
  type CreatorSeoSource,
  type OrganizationSeoSource,
  type PublicPageSeo,
} from './publicPageSeo.js'
import { escapeHtml } from './shareMeta.js'

/**
 * Search engines and AI crawlers. Link-preview scrapers are recognised
 * separately (shareMeta.ts); Applebot is both, and gets the full page.
 */
const SEARCH_CRAWLER = /googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|bingbot|bingpreview|msnbot|adidxbot|duckduckbot|duckassistbot|yandex|baiduspider|sogou|seznambot|yeti|naver|petalbot|applebot|amazonbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|anthropic-ai|perplexitybot|perplexity-user|youbot|cohere-ai|mistralai-user|ccbot|diffbot|bytespider/i

export function isSearchCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && SEARCH_CRAWLER.test(userAgent)
}

export type CrawlerRoute =
  | { kind: 'campaign'; key: string; donate: boolean; byId: boolean }
  | { kind: 'organization'; key: string }
  | { kind: 'creator'; key: string }

const SAFE_KEY = /^[\w-]{1,120}$/

function decodeKey(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    const key = decodeURIComponent(raw)
    return SAFE_KEY.test(key) ? key : null
  } catch {
    return null
  }
}

/** The public record a path shows, or null for any other path. */
export function crawlerRouteFromPath(pathname: string): CrawlerRoute | null {
  let match = /^\/c\/([^/]+)(\/donate)?\/?$/i.exec(pathname)
  if (match) {
    const key = decodeKey(match[1])
    return key ? { kind: 'campaign', key, donate: !!match[2], byId: false } : null
  }
  match = /^\/campaigns\/([a-f0-9]{24})\/?$/i.exec(pathname)
  if (match) return { kind: 'campaign', key: match[1], donate: false, byId: true }
  match = /^\/organizations\/([^/]+)\/?$/i.exec(pathname)
  if (match) {
    const key = decodeKey(match[1])
    return key ? { kind: 'organization', key } : null
  }
  match = /^\/creators\/([^/]+)\/?$/i.exec(pathname)
  if (match) {
    const key = decodeKey(match[1])
    return key ? { kind: 'creator', key } : null
  }
  return null
}

/** The API path that holds a route's record, readable without signing in. */
export function apiPathFor(route: CrawlerRoute): string {
  switch (route.kind) {
    case 'campaign': return `/api/v1/campaigns/slug/${encodeURIComponent(route.key)}/public`
    case 'organization': return `/api/v1/organizations/${encodeURIComponent(route.key)}`
    case 'creator': return `/api/v1/creators/${encodeURIComponent(route.key)}`
  }
}

// ── Head ───────────────────────────────────────────────────

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.:]/g, '\\$&')}"\\s+content=")[^"]*(")`, 'i')
  if (pattern.test(html)) return html.replace(pattern, (_m, start: string, end: string) => `${start}${escapeHtml(value)}${end}`)
  return html.replace(/<\/head>/i, () => `    <meta ${attr}="${key}" content="${escapeHtml(value)}" />\n  </head>`)
}

/** JSON for a <script> element: `<` escaped so nothing in the data can close it. */
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * index.html with a page's head: title, description, robots, canonical, share
 * tags and JSON-LD, each written once (existing tags are edited in place).
 */
export function withHead(html: string, seo: PublicPageSeo, origin = APP_ORIGIN): string {
  const url = `${origin}${seo.path}`
  let out = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(seo.title)}</title>`)
  const tags: ['name' | 'property', string, string][] = [
    ['name', 'title', seo.title],
    ['name', 'description', seo.description],
    ['name', 'robots', seo.robots ?? 'index, follow, max-image-preview:large'],
    ['property', 'og:type', seo.type ?? 'website'],
    ['property', 'og:url', url],
    ['property', 'og:title', seo.title],
    ['property', 'og:description', seo.description],
    ['name', 'twitter:url', url],
    ['name', 'twitter:title', seo.title],
    ['name', 'twitter:description', seo.description],
  ]
  for (const [attr, key, value] of tags) out = setMeta(out, attr, key, value)
  if (seo.image) {
    // The static card's size and type describe the default image, not this one.
    out = out.replace(/\s*<meta\s+property="og:image:(?:type|width|height)"\s+content="[^"]*"\s*\/?>/gi, '')
    for (const [attr, key] of [['property', 'og:image'], ['name', 'twitter:image']] as const) out = setMeta(out, attr, key, seo.image)
    for (const [attr, key] of [['property', 'og:image:alt'], ['name', 'twitter:image:alt']] as const) out = setMeta(out, attr, key, seo.title)
  }
  const canonical = `<link rel="canonical" href="${escapeHtml(seo.canonicalUrl ?? url)}" />`
  out = /<link\s+rel="canonical"[^>]*>/i.test(out)
    ? out.replace(/<link\s+rel="canonical"[^>]*>/i, () => canonical)
    : out.replace(/<\/head>/i, () => `    ${canonical}\n  </head>`)
  if (seo.jsonLd) {
    // The id the app's useSeo replaces on navigation, so there is only ever one.
    out = out.replace(/<\/head>/i, () => `    <script type="application/ld+json" id="route-jsonld">${scriptJson(seo.jsonLd)}</script>\n  </head>`)
  }
  return out
}

/** index.html with the snapshot inside #root. */
export function withBody(html: string, body: string): string {
  return html.replace(/<div id="root"><\/div>/, () => `<div id="root">${body}</div>`)
}

// ── Snapshots ──────────────────────────────────────────────

const e = escapeHtml

function cedis(amount: unknown): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return `GH₵${value.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`
}

function formatDate(value: unknown): string | null {
  const date = new Date(String(value ?? ''))
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Plain text as paragraphs: blank lines split them, single newlines become <br>. */
function paragraphs(text: string | undefined): string {
  return (text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${e(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function breadcrumbs(items: { name: string; path?: string }[]): string {
  return `<nav aria-label="Breadcrumb"><ol>${items
    .map((item) => (item.path ? `<li><a href="${e(item.path)}">${e(item.name)}</a></li>` : `<li aria-current="page">${e(item.name)}</li>`))
    .join('')}</ol></nav>`
}

const SITE_LINKS = `<header><a href="/">Ujimora</a> <nav aria-label="Main"><a href="/explore">Explore campaigns</a> <a href="/organizations">Organizations</a> <a href="https://ujimora.com/how-it-works">How it works</a> <a href="https://ujimora.com/guides">Fundraising guides</a></nav></header>`

function page(main: string): string {
  return `${SITE_LINKS}<main>${main}</main>`
}

const CATEGORY_LABEL: Record<string, string> = {
  medical: 'Medical', education: 'Education', emergency: 'Emergency', business: 'Business',
  community: 'Community', religious: 'Religious', creative: 'Creative',
}

export interface CampaignSnapshotSource extends CampaignSeoSource {
  goalAmount?: number
  raisedAmount?: number
  category?: string
  endDate?: string
  donorCount?: number
}

export function campaignSnapshot(campaign: CampaignSnapshotSource): string {
  const facts = [
    campaign.category ? `${CATEGORY_LABEL[campaign.category] ?? e(campaign.category)} campaign` : 'Campaign',
    `${cedis(campaign.raisedAmount)} raised of a ${cedis(campaign.goalAmount)} goal`,
    typeof campaign.donorCount === 'number' ? `${campaign.donorCount} ${campaign.donorCount === 1 ? 'donor' : 'donors'}` : null,
    formatDate(campaign.endDate) ? `ends ${formatDate(campaign.endDate)}` : null,
  ].filter(Boolean).join(' · ')
  const cover = campaign.socialPreview?.imageUrl ?? campaign.imageUrls?.[0]
  const path = campaignPath(campaign)
  return page(
    breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }, { name: campaign.title }]) +
      `<article><h1>${e(campaign.title)}</h1><p>${facts}</p>` +
      (cover && /^https:\/\//i.test(cover) ? `<img src="${e(cover)}" alt="${e(campaign.title)}">` : '') +
      paragraphs(campaign.description) +
      `<p><a href="${e(path)}/donate">Donate to this campaign</a> by mobile money or card, in Ghana cedis.</p></article>`,
  )
}

export interface OrganizationSnapshotSource extends OrganizationSeoSource {
  city?: string
  verified?: boolean
  campaignCount?: number
  totalRaised?: number
}

export function organizationSnapshot(org: OrganizationSnapshotSource, campaigns: { title: string; slug?: string; id: string }[] = []): string {
  const where = [org.city, org.country].filter(Boolean).join(', ')
  const facts = [
    org.verified ? 'Verified organization' : 'Organization',
    where ? `in ${e(where)}` : null,
    typeof org.campaignCount === 'number' ? `${org.campaignCount} ${org.campaignCount === 1 ? 'campaign' : 'campaigns'}` : null,
    typeof org.totalRaised === 'number' ? `${cedis(org.totalRaised)} raised` : null,
  ].filter(Boolean).join(' · ')
  const list = campaigns.length
    ? `<section><h2>Campaigns</h2><ul>${campaigns.map((c) => `<li><a href="${e(campaignPath(c))}">${e(c.title)}</a></li>`).join('')}</ul></section>`
    : ''
  return page(
    breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Organizations', path: '/organizations' }, { name: org.name }]) +
      `<article><h1>${e(org.name)}</h1><p>${facts}</p>` +
      paragraphs(org.description) +
      (org.impactStatement && org.impactStatement !== org.description ? paragraphs(org.impactStatement) : '') +
      (org.website && /^https?:\/\//i.test(org.website) ? `<p><a href="${e(org.website)}" rel="nofollow noopener">${e(org.name)} website</a></p>` : '') +
      list +
      `</article>`,
  )
}

export interface CreatorSnapshotSource extends CreatorSeoSource {
  supporterCount?: number
  tipsEnabled?: boolean
}

export function creatorSnapshot(creator: CreatorSnapshotSource): string {
  return page(
    breadcrumbs([{ name: 'Home', path: '/' }, { name: creator.displayName }]) +
      `<article><h1>${e(creator.displayName)}</h1>` +
      (creator.tagline ? `<p>${e(creator.tagline)}</p>` : '') +
      paragraphs(creator.bio) +
      (typeof creator.supporterCount === 'number' ? `<p>${creator.supporterCount} ${creator.supporterCount === 1 ? 'supporter' : 'supporters'} on Ujimora</p>` : '') +
      (creator.tipsEnabled === false ? '' : `<p>Send ${e(creator.displayName)} a tip in Ghana cedis by mobile money or card; no account needed.</p>`) +
      `</article>`,
  )
}

/** The not-found answer: HTTP 404, never indexed. */
export function notFoundHtml(html: string, path: string, origin = APP_ORIGIN): string {
  const head = withHead(html, {
    title: 'Page not found | Ujimora',
    description: 'That page does not exist. Browse live campaigns on Ujimora instead.',
    path,
    robots: 'noindex, follow',
  }, origin)
  return withBody(head, page(`<h1>Page not found</h1><p>This page does not exist or is no longer public. <a href="/explore">Browse campaigns</a>.</p>`))
}

export interface CrawlerAnswer {
  status: number
  html?: string
  /** Set for a 301 to the record's canonical URL. */
  location?: string
}

/**
 * The crawler's answer for a route, given the record the API returned (or null
 * when the API said 404). Old slugs and /campaigns/:id redirect to the
 * campaign's current URL, so search engines consolidate on one address.
 */
export function crawlerAnswer(html: string, route: CrawlerRoute, record: unknown, extras: { campaigns?: { title: string; slug?: string; id: string }[] } = {}, origin = APP_ORIGIN): CrawlerAnswer {
  const requested = route.kind === 'campaign' ? (route.byId ? `/campaigns/${route.key}` : `/c/${encodeURIComponent(route.key)}${route.donate ? '/donate' : ''}`) : `/${route.kind === 'organization' ? 'organizations' : 'creators'}/${encodeURIComponent(route.key)}`
  if (!record || typeof record !== 'object') return { status: 404, html: notFoundHtml(html, requested, origin) }

  if (route.kind === 'campaign') {
    const campaign = record as CampaignSnapshotSource
    if (!campaign.id || !campaign.title) return { status: 404, html: notFoundHtml(html, requested, origin) }
    const canonical = campaignPath(campaign)
    if (route.donate) {
      const slug = campaign.slug || campaign.id
      if (slug !== route.key) return { status: 301, location: `${canonical}/donate` }
      return { status: 200, html: withHead(html, campaignDonateSeo(campaign, slug, origin), origin) }
    }
    if (route.byId || canonical !== requested) return { status: 301, location: canonical }
    return { status: 200, html: withBody(withHead(html, campaignSeo(campaign, origin), origin), campaignSnapshot(campaign)) }
  }
  if (route.kind === 'organization') {
    const org = record as OrganizationSnapshotSource
    if (!org.name || !org.slug) return { status: 404, html: notFoundHtml(html, requested, origin) }
    if (org.slug !== route.key) return { status: 301, location: `/organizations/${encodeURIComponent(org.slug)}` }
    return { status: 200, html: withBody(withHead(html, organizationSeo(org, origin), origin), organizationSnapshot(org, extras.campaigns)) }
  }
  const creator = record as CreatorSnapshotSource
  if (!creator.displayName || !creator.handle) return { status: 404, html: notFoundHtml(html, requested, origin) }
  if (creator.handle !== route.key) return { status: 301, location: `/creators/${encodeURIComponent(creator.handle)}` }
  return { status: 200, html: withBody(withHead(html, creatorSeo(creator, origin), origin), creatorSnapshot(creator)) }
}
