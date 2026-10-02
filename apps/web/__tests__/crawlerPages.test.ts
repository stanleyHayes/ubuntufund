import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { breadcrumbList, organization } from '@ubuntu-fund/ui'
import middleware from '../middleware'
import {
  apiPathFor,
  campaignSnapshot,
  crawlerAnswer,
  crawlerRouteFromPath,
  isSearchCrawler,
  notFoundHtml,
  withBody,
  withHead,
} from '@/lib/crawlerPages'
import { breadcrumbTrail, campaignDonateSeo, campaignSeo, creatorSeo, organizationNode, organizationSeo } from '@/lib/publicPageSeo'

// Vitest runs with apps/web as the cwd; this is the real shipped shell.
const INDEX_HTML = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
const GOOGLEBOT = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const CHROME = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const WHATSAPP = 'WhatsApp/2.23.20.0 A'

const campaign = {
  id: 'a1b2c3d4e5f6a1b2c3d4e5f6',
  slug: 'kofi-surgery',
  title: 'Help Kofi <get> surgery & recover',
  description: 'Kofi needs a kidney operation.\n\nEvery cedi counts <b>today</b>.',
  status: 'active',
  goalAmount: 20000,
  raisedAmount: 5250.5,
  category: 'medical',
  endDate: '2026-11-30T00:00:00.000Z',
  donorCount: 12,
  imageUrls: ['https://res.cloudinary.com/demo/image/upload/kofi.jpg'],
  socialPreview: { summary: 'Kofi needs a kidney operation at the teaching hospital. Every cedi counts towards the operation and his recovery.' },
}
const org = { id: 'b1b2c3d4e5f6a1b2c3d4e5f6', name: 'Tamale Care Foundation', slug: 'tamale-care-foundation', description: 'We fund clinics in the Northern Region.', impactStatement: 'Tamale Care Foundation has raised GHS 10,000 across 2 campaigns on Ujimora.', logoUrl: 'https://res.cloudinary.com/demo/logo.png', coverUrl: '', country: 'Ghana', city: '', verified: true, website: 'https://tamalecare.org', campaignCount: 2, totalRaised: 10000 }
const creator = { handle: 'ama-sings', displayName: 'Ama Sings', tagline: 'Gospel songs from Kumasi', bio: 'I write and record gospel music.', supporterCount: 3, tipsEnabled: true }

describe('crawler recognition and routes', () => {
  it('recognises search engines and AI crawlers, not browsers or share scrapers', () => {
    for (const ua of [GOOGLEBOT, 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot', 'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (compatible; PerplexityBot/1.0)', 'DuckDuckBot/1.1', 'Mozilla/5.0 (Macintosh) Applebot/0.1']) {
      expect(isSearchCrawler(ua), ua).toBe(true)
    }
    for (const ua of [CHROME, WHATSAPP, null, '']) expect(isSearchCrawler(ua)).toBe(false)
  })

  it('maps public record paths to the API that holds them', () => {
    expect(crawlerRouteFromPath('/c/kofi-surgery')).toEqual({ kind: 'campaign', key: 'kofi-surgery', donate: false, byId: false })
    expect(crawlerRouteFromPath('/c/kofi-surgery/donate')).toEqual({ kind: 'campaign', key: 'kofi-surgery', donate: true, byId: false })
    expect(crawlerRouteFromPath('/campaigns/a1b2c3d4e5f6a1b2c3d4e5f6')).toEqual({ kind: 'campaign', key: 'a1b2c3d4e5f6a1b2c3d4e5f6', donate: false, byId: true })
    expect(crawlerRouteFromPath('/organizations/tamale-care-foundation')).toEqual({ kind: 'organization', key: 'tamale-care-foundation' })
    expect(crawlerRouteFromPath('/creators/ama-sings')).toEqual({ kind: 'creator', key: 'ama-sings' })
    for (const path of ['/campaigns/new', '/c/kofi/live/abc', '/c/%3Cscript%3E', '/organizations', '/explore']) expect(crawlerRouteFromPath(path), path).toBeNull()
    expect(apiPathFor({ kind: 'organization', key: 'tamale-care-foundation' })).toBe('/api/v1/organizations/tamale-care-foundation')
    expect(apiPathFor({ kind: 'creator', key: 'ama-sings' })).toBe('/api/v1/creators/ama-sings')
  })
})

describe('the head the pages and the crawlers share', () => {
  it('builds the same JSON-LD as the shared UI helpers the pages used before', () => {
    const items = [{ name: 'Home', path: '/' }, { name: 'Explore', path: '/explore' }, { name: 'A campaign' }]
    expect(breadcrumbTrail('https://app.ujimora.com', items)).toEqual(breadcrumbList('https://app.ujimora.com', items))
    const node = { name: 'Org', url: 'https://app.ujimora.com/organizations/org', description: 'D', logo: 'https://x/logo.png', areaServed: 'Ghana', sameAs: ['https://org.example', 'ftp://bad'] }
    expect(organizationNode(node)).toEqual(organization(node))
    expect(organizationNode({ name: 'Org', url: 'u' })).toEqual(organization({ name: 'Org', url: 'u' }))
  })

  it('describes a campaign as its page always has', () => {
    const seo = campaignSeo(campaign)
    expect(seo.title).toBe('Help Kofi <get> surgery & recover | Ujimora')
    expect(seo.path).toBe('/c/kofi-surgery')
    expect(seo.description).toBe(campaign.socialPreview.summary)
    expect(seo.image).toBe(campaign.imageUrls[0])
    expect(seo.robots).toBeUndefined()
    expect(campaignSeo({ ...campaign, status: 'pending_review' }).robots).toBe('noindex, follow')
    expect(campaignSeo({ ...campaign, slug: undefined }).path).toBe('/c/a1b2c3d4e5f6a1b2c3d4e5f6')
    expect(campaignSeo({ ...campaign, socialPreview: undefined, description: 'Short.' }).description).toBe('Short. Donate by mobile money or card on Ujimora.')
    expect(campaignDonateSeo(campaign, 'kofi-surgery')).toMatchObject({ robots: 'noindex, follow', canonicalUrl: 'https://app.ujimora.com/c/kofi-surgery', path: '/c/kofi-surgery/donate' })
    expect(organizationSeo(org).path).toBe('/organizations/tamale-care-foundation')
    expect(creatorSeo(creator).title).toBe('Support Ama Sings | Ujimora')
  })
})

describe('crawler pages', () => {
  it('writes each head tag once, escaped, with the JSON-LD the page declares', () => {
    const html = withHead(INDEX_HTML, campaignSeo(campaign))
    expect(html).toContain('<title>Help Kofi &lt;get&gt; surgery &amp; recover | Ujimora</title>')
    expect(html.match(/rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/name="robots"/g)).toHaveLength(1)
    expect(html.match(/property="og:title"/g)).toHaveLength(1)
    expect(html).toContain('<link rel="canonical" href="https://app.ujimora.com/c/kofi-surgery" />')
    expect(html).toContain('<meta property="og:type" content="article" />')
    expect(html).not.toContain('og:image:width')
    const jsonLd = html.match(/<script type="application\/ld\+json" id="route-jsonld">([^<]*)<\/script>/)?.[1]
    expect(JSON.parse(jsonLd!)).toEqual(campaignSeo(campaign).jsonLd)
  })

  it('puts the campaign itself in the HTML, escaped', () => {
    const body = campaignSnapshot(campaign)
    expect(body).toContain('<h1>Help Kofi &lt;get&gt; surgery &amp; recover</h1>')
    expect(body).toContain('<p>Kofi needs a kidney operation.</p><p>Every cedi counts &lt;b&gt;today&lt;/b&gt;.</p>')
    expect(body).toContain('Medical campaign · GH₵5,250.5 raised of a GH₵20,000 goal · 12 donors · ends 30 November 2026')
    expect(body).toContain('<a href="/c/kofi-surgery/donate">Donate to this campaign</a>')
    expect(body).not.toContain('<b>')
    const page = withBody(INDEX_HTML, body)
    expect(page).toContain('<div id="root"><header>')
    expect(page).toContain('<script type="module"')
  })

  it('answers a live campaign with its page, and redirects other addresses to it', () => {
    const page = crawlerAnswer(INDEX_HTML, { kind: 'campaign', key: 'kofi-surgery', donate: false, byId: false }, campaign)
    expect(page.status).toBe(200)
    expect(page.html).toContain('<h1>Help Kofi')
    expect(crawlerAnswer(INDEX_HTML, { kind: 'campaign', key: campaign.id, donate: false, byId: true }, campaign)).toEqual({ status: 301, location: '/c/kofi-surgery' })
    expect(crawlerAnswer(INDEX_HTML, { kind: 'campaign', key: 'old-slug', donate: false, byId: false }, campaign)).toEqual({ status: 301, location: '/c/kofi-surgery' })
    expect(crawlerAnswer(INDEX_HTML, { kind: 'campaign', key: 'old-slug', donate: true, byId: false }, campaign)).toEqual({ status: 301, location: '/c/kofi-surgery/donate' })
    const donate = crawlerAnswer(INDEX_HTML, { kind: 'campaign', key: 'kofi-surgery', donate: true, byId: false }, campaign)
    expect(donate.status).toBe(200)
    expect(donate.html).toContain('<meta name="robots" content="noindex, follow" />')
    expect(donate.html).toContain('<div id="root"></div>')
  })

  it('answers 404, never indexed, when the record does not exist', () => {
    for (const route of [{ kind: 'campaign', key: 'gone', donate: false, byId: false }, { kind: 'organization', key: 'gone' }, { kind: 'creator', key: 'gone' }] as const) {
      const answer = crawlerAnswer(INDEX_HTML, route, null)
      expect(answer.status).toBe(404)
      expect(answer.html).toContain('<meta name="robots" content="noindex, follow" />')
    }
    expect(notFoundHtml(INDEX_HTML, '/c/gone')).toContain('<h1>Page not found</h1>')
  })

  it('answers organizations and creators with their own pages', () => {
    const orgPage = crawlerAnswer(INDEX_HTML, { kind: 'organization', key: org.slug }, org, { campaigns: [{ id: campaign.id, slug: campaign.slug, title: campaign.title }] })
    expect(orgPage.status).toBe(200)
    expect(orgPage.html).toContain('<h1>Tamale Care Foundation</h1>')
    expect(orgPage.html).toContain('Verified organization')
    expect(orgPage.html).toContain('<a href="/c/kofi-surgery">Help Kofi &lt;get&gt; surgery &amp; recover</a>')
    expect(orgPage.html).toContain('rel="nofollow noopener"')
    expect(crawlerAnswer(INDEX_HTML, { kind: 'organization', key: org.id }, org)).toEqual({ status: 301, location: '/organizations/tamale-care-foundation' })
    const creatorPage = crawlerAnswer(INDEX_HTML, { kind: 'creator', key: 'ama-sings' }, creator)
    expect(creatorPage.status).toBe(200)
    expect(creatorPage.html).toContain('<h1>Ama Sings</h1>')
    expect(creatorPage.html).toContain('<title>Support Ama Sings | Ujimora</title>')
  })
})

describe('crawler middleware', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  const call = (path: string, ua: string) => middleware(new Request(`https://app.ujimora.com${path}`, { headers: { 'user-agent': ua } }))
  function stubFetch(api: (url: string) => Promise<Response>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/index.html') ? new Response(INDEX_HTML, { status: 200 }) : api(String(input)))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('serves Googlebot the full campaign page', async () => {
    const fetchMock = stubFetch(async () => Response.json({ data: campaign }))
    const response = await call('/c/kofi-surgery', GOOGLEBOT)
    expect(response?.status).toBe(200)
    expect(response?.headers.get('vary')).toBe('user-agent')
    const body = await response?.text()
    expect(body).toContain('<h1>Help Kofi &lt;get&gt; surgery &amp; recover</h1>')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.ujimora.com/api/v1/campaigns/slug/kofi-surgery/public')
  })

  it('redirects crawlers from an id address to the campaign’s own', async () => {
    stubFetch(async () => Response.json({ data: campaign }))
    const response = await call('/campaigns/a1b2c3d4e5f6a1b2c3d4e5f6', GOOGLEBOT)
    expect(response?.status).toBe(301)
    expect(response?.headers.get('location')).toBe('https://app.ujimora.com/c/kofi-surgery')
  })

  it('answers 404 for a record the API does not have', async () => {
    stubFetch(async () => Response.json({ message: 'Campaign not found' }, { status: 404 }))
    const response = await call('/c/no-such-campaign', GOOGLEBOT)
    expect(response?.status).toBe(404)
  })

  it('lists an organization’s campaigns, and drops any that are not public', async () => {
    stubFetch(async (url) => url.endsWith('/campaigns')
      ? Response.json({ data: [{ id: campaign.id, slug: campaign.slug, title: campaign.title, status: 'active' }, { id: 'c2', slug: 'secret', title: 'Draft one', status: 'draft' }] })
      : Response.json({ data: org }))
    const body = await (await call('/organizations/tamale-care-foundation', GOOGLEBOT))?.text()
    expect(body).toContain('<a href="/c/kofi-surgery">')
    expect(body).not.toContain('Draft one')
  })

  it('leaves the page alone when the API is unhealthy', async () => {
    stubFetch(async () => new Response('upstream error', { status: 502 }))
    expect(await call('/c/kofi-surgery', GOOGLEBOT)).toBeUndefined()
  })

  it('still leaves browsers alone without calling the API', async () => {
    const fetchMock = stubFetch(async () => new Response('{}'))
    expect(await call('/organizations/tamale-care-foundation', CHROME)).toBeUndefined()
    expect(await call('/creators/ama-sings', CHROME)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps share scrapers on the share card, only for campaigns', async () => {
    const fetchMock = stubFetch(async () => Response.json({ data: org }))
    expect(await call('/organizations/tamale-care-foundation', WHATSAPP)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
