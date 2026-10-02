import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  fetchPrerenderData,
  fillPage,
  headFor,
  pageUrl,
  renderLlmsTxt,
  renderNotFoundHtml,
  renderPageHtml,
  renderRouteHtml,
  renderShellHtml,
  routeHeads,
  withSocialProfiles,
} from '../scripts/prerender'
import { SITE_ORIGIN } from '../src/lib/pageSeo'
import { GUIDES } from '../src/data/guides'
import { LEGAL_POLICIES } from '@ubuntu-fund/types/src/legal'

// Vitest runs with apps/marketing as the cwd.
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const template = read('index.html')
const sitemap = read('public/sitemap.xml')
const canonicals = (html: string) => [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1])
const meta = (html: string, attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]
const page = { html: '<main><h1>Hello</h1></main>', styles: '<style data-emotion="css abc">.css-abc{color:red}</style>', data: {} }

describe('prerendered route heads', () => {
  it('gives every route its own title, description and self-referencing canonical', () => {
    const heads = routeHeads()
    for (const head of heads) {
      const html = renderRouteHtml(template, head)
      const url = pageUrl(head)
      expect(canonicals(html), head.path).toEqual([url])
      expect(meta(html, 'property', 'og:url')).toBe(url)
      expect(meta(html, 'name', 'twitter:url')).toBe(url)
      expect(html).toContain(`<title>${head.title.replace(/&/g, '&amp;')}</title>`)
      expect(meta(html, 'name', 'description')).toBeTruthy()
    }
    expect(new Set(heads.map((h) => h.path)).size).toBe(heads.length)
    expect(new Set(heads.map((h) => h.title)).size).toBe(heads.length)
    expect(new Set(heads.map((h) => h.description)).size).toBe(heads.length)
  })

  it('covers every URL the sitemap submits, and the sitemap covers every route', () => {
    const generated = new Set(routeHeads().map(pageUrl))
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.filter((url) => !generated.has(url))).toEqual([])
    expect([...generated].filter((url) => !listed.includes(url))).toEqual([])
  })

  it('renders blog posts as articles', () => {
    const [post] = routeHeads([{ slug: 'a-post', title: 'A post', excerpt: 'About it.' }]).slice(-1)
    const html = renderRouteHtml(template, post)
    expect(canonicals(html)).toEqual([`${SITE_ORIGIN}/blog/a-post`])
    expect(meta(html, 'property', 'og:type')).toBe('article')
  })

  it('escapes page copy instead of breaking the markup', () => {
    const html = renderRouteHtml(template, { title: 'Fees & "tips" <now> $& $1', description: 'Say "hi" & $2', path: '/x' })
    expect(html).toContain('<title>Fees &amp; "tips" &lt;now&gt; $&amp; $1</title>')
    expect(meta(html, 'name', 'description')).toBe('Say &quot;hi&quot; &amp; $2')
  })

  it('fails the build rather than shipping a head it could not rewrite', () => {
    expect(() => renderRouteHtml(template.replace(/<link rel="canonical"[^>]*>/, ''), { title: 't', description: 'd', path: '/about' })).toThrow(/canonical/)
  })

  it('writes the robots directive, image and JSON-LD a page declares', () => {
    const html = renderRouteHtml(template, {
      title: 'T', description: 'D', path: '/blog/x', type: 'article', robots: 'noindex, follow',
      image: 'https://images.example/cover.jpg', jsonLd: { '@type': 'BlogPosting', headline: '</script><script>alert(1)</script>' },
    })
    expect(meta(html, 'name', 'robots')).toBe('noindex, follow')
    expect(meta(html, 'property', 'og:image')).toBe('https://images.example/cover.jpg')
    expect(html).not.toContain('og:image:width')
    const jsonLd = html.match(/<script type="application\/ld\+json" id="route-jsonld">([^<]*)<\/script>/)?.[1]
    expect(JSON.parse(jsonLd!)).toEqual({ '@type': 'BlogPosting', headline: '</script><script>alert(1)</script>' })
    expect(html).not.toContain('</script><script>alert(1)')
  })

  it('leaves the rewrite fallback without a canonical or page URL', () => {
    const html = renderShellHtml(template)
    expect(canonicals(html)).toEqual([])
    expect(meta(html, 'property', 'og:url')).toBeUndefined()
    expect(meta(html, 'name', 'twitter:url')).toBeUndefined()
    expect(html).toContain('<div id="root"></div>')
  })
})

describe('prerendered pages', () => {
  it('puts the markup in #root and its styles in <head>', () => {
    const html = renderPageHtml(template, { title: 'About', description: 'D', path: '/about' }, page)
    expect(html).toContain('<div id="root"><main><h1>Hello</h1></main></div>')
    expect(html.indexOf('data-emotion="css abc"')).toBeLessThan(html.indexOf('</head>'))
    expect(html).not.toContain('id="prerender-data"')
  })

  it('embeds the data a page read, safely', () => {
    const html = fillPage(template, { ...page, data: { 'blog:x': { body: '</script><!-- <b>' } } })
    const block = html.match(/<script type="application\/json" id="prerender-data">([^<]*)<\/script>/)?.[1]
    expect(JSON.parse(block!)).toEqual({ 'blog:x': { body: '</script><!-- <b>' } })
    expect(html.indexOf('id="prerender-data"')).toBeLessThan(html.indexOf('<div id="root">'))
  })

  it('keeps `$` sequences in page markup literally', () => {
    const html = fillPage(template, { ...page, html: '<p>GH₵$& and $1</p>' })
    expect(html).toContain('<p>GH₵$& and $1</p>')
  })

  it('serves a not-found page that names no URL and is never indexed', () => {
    const html = renderNotFoundHtml(template, { title: 'Page not found | Ujimora', description: 'Gone.', path: '/__x__', jsonLd: { '@type': 'Thing' } }, page)
    expect(canonicals(html)).toEqual([])
    expect(meta(html, 'property', 'og:url')).toBeUndefined()
    expect(meta(html, 'name', 'robots')).toBe('noindex, follow')
    expect(html).toContain('<title>Page not found | Ujimora</title>')
    expect(html).not.toContain('route-jsonld')
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('stops the build when a page declares another page as itself', () => {
    const route = { title: 'A', description: 'B', path: '/about' }
    expect(() => headFor(route, { html: '', styles: '', data: {}, head: { ...route, path: '/' } })).toThrow(/rendered a head for \//)
    expect(headFor(route, { html: '', styles: '', data: {}, head: null })).toEqual(route)
  })
})

describe('build-time data', () => {
  it('stays offline unless the build asks for live data', async () => {
    const saved = { VERCEL: process.env.VERCEL, PRERENDER_DATA: process.env.PRERENDER_DATA, PRERENDER_BLOG: process.env.PRERENDER_BLOG }
    delete process.env.VERCEL; delete process.env.PRERENDER_DATA; delete process.env.PRERENDER_BLOG
    try {
      expect(await fetchPrerenderData({ warn: () => {} })).toEqual({ data: {}, posts: [] })
    } finally {
      Object.assign(process.env, Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== undefined)))
    }
  })
})

describe('site-wide structured data', () => {
  const organizationOf = (html: string) => {
    const json = html.match(/<script type="application\/ld\+json" id="site-jsonld">([\s\S]*?)<\/script>/)?.[1]
    return (JSON.parse(json!) as { '@graph': { '@type': string; sameAs?: string[] }[] })['@graph'].find((n) => n['@type'] === 'Organization')!
  }

  it('claims no social profiles until the owner enters them', () => {
    expect(organizationOf(template).sameAs).toBeUndefined()
    expect(withSocialProfiles(template, { socials: { facebook: '', x: '' } })).toBe(template)
    expect(withSocialProfiles(template, undefined)).toBe(template)
  })

  it('adds the https profiles from the contact content, once each', () => {
    const html = withSocialProfiles(template, { socials: { facebook: 'https://facebook.com/ujimora', x: 'javascript:alert(1)', instagram: 'https://instagram.com/ujimora', linkedin: 'https://facebook.com/ujimora' } })
    expect(organizationOf(html).sameAs).toEqual(['https://facebook.com/ujimora', 'https://instagram.com/ujimora'])
  })
})

describe('llms.txt', () => {
  const text = renderLlmsTxt()
  const links = [...text.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1])

  it('lists every guide and every policy', () => {
    for (const guide of GUIDES) expect(text).toContain(`(${SITE_ORIGIN}${guide.path})`)
    for (const policy of LEGAL_POLICIES) expect(text).toContain(`(${SITE_ORIGIN}${policy.route})`)
  })

  it('links only to pages the site actually serves', () => {
    const served = new Set(routeHeads().map(pageUrl))
    const marketing = links.filter((url) => url.startsWith(SITE_ORIGIN))
    expect(marketing.length).toBeGreaterThan(20)
    expect(marketing.filter((url) => !served.has(url))).toEqual([])
  })

  it('states the fees the pricing page shows', () => {
    expect(text).toContain('5% on Free, 3.5% on Starter, 2% on Pro and Organization, 1% on Enterprise')
  })
})
