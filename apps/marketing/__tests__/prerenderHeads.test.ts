import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderRouteHtml, renderShellHtml, routeHeads } from '../scripts/prerenderHeads'
import { SITE_ORIGIN } from '../src/lib/pageSeo'

// Vitest runs with apps/marketing as the cwd.
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const template = read('index.html')
const sitemap = read('public/sitemap.xml')
const canonicals = (html: string) => [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1])
const meta = (html: string, attr: string, key: string) => html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1]

describe('prerendered route heads', () => {
  it('gives every route its own title, description and self-referencing canonical', () => {
    const heads = routeHeads()
    for (const head of heads) {
      const html = renderRouteHtml(template, head)
      const url = `${SITE_ORIGIN}${head.path === '/' ? '/' : head.path}`
      expect(canonicals(html), head.path).toEqual([url])
      expect(meta(html, 'property', 'og:url')).toBe(url)
      expect(meta(html, 'name', 'twitter:url')).toBe(url)
      expect(html).toContain(`<title>${head.title.replace(/&/g, '&amp;')}</title>`)
      expect(meta(html, 'name', 'description')).toBeTruthy()
    }
    expect(new Set(heads.map((h) => h.path)).size).toBe(heads.length)
    expect(new Set(heads.map((h) => h.title)).size).toBe(heads.length)
  })

  it('covers every URL the sitemap submits', () => {
    const generated = new Set(routeHeads().map((h) => `${SITE_ORIGIN}${h.path === '/' ? '/' : h.path}`))
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(listed.length).toBeGreaterThan(0)
    expect(listed.filter((url) => !generated.has(url))).toEqual([])
  })

  it('renders blog posts as articles', () => {
    const [post] = routeHeads([{ title: 'A post | Ujimora', description: 'About it.', path: '/blog/a-post', type: 'article' }]).slice(-1)
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

  it('leaves the rewrite fallback without a canonical or page URL', () => {
    const html = renderShellHtml(template)
    expect(canonicals(html)).toEqual([])
    expect(meta(html, 'property', 'og:url')).toBeUndefined()
    expect(meta(html, 'name', 'twitter:url')).toBeUndefined()
    expect(html).toContain('<div id="root">')
  })
})
