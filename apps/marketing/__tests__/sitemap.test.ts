import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { LEGAL_POLICIES } from '@ubuntu-fund/types/src/legal'

/**
 * The sitemap is hand-maintained, and it had already drifted: it listed 11 URLs
 * while the site routed 25, silently omitting every legal policy and every blog
 * post. A sitemap that misses a page is not a neutral omission — it is how a
 * page stays undiscovered.
 *
 * These tests fail when a route is added without a sitemap entry, which is the
 * only thing that reliably keeps a hand-written sitemap honest.
 */
// Vitest runs with apps/marketing as the cwd.
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const sitemap = read('public/sitemap.xml')
const appTsx = read('src/App.tsx')
const blogPage = read('src/pages/BlogPage.tsx')

const listed = new Set(
  [...sitemap.matchAll(/<loc>https:\/\/ujimora\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/'),
)

describe('sitemap.xml', () => {
  it('lists every static route declared in App.tsx', () => {
    const routes = [...appTsx.matchAll(/path="(\/[^"*:]*)"/g)]
      .map((m) => m[1])
      // Parameterised and catch-all routes are covered by their own assertions.
      .filter((p) => !p.includes(':') && p !== '*')
    expect(routes.length).toBeGreaterThan(5)
    for (const route of routes) {
      expect(listed, `route ${route} is routable but missing from sitemap.xml`).toContain(route)
    }
  })

  it('lists every legal policy', () => {
    // These are the pages a search for "ujimora refund policy" should reach;
    // all eight were absent.
    expect(LEGAL_POLICIES.length).toBeGreaterThanOrEqual(8)
    for (const policy of LEGAL_POLICIES) {
      expect(listed, `policy ${policy.route} missing from sitemap.xml`).toContain(policy.route)
    }
  })

  it('lists every blog post', () => {
    const slugs = [...blogPage.matchAll(/slug: '([^']+)'/g)].map((m) => m[1])
    expect(slugs.length).toBeGreaterThan(0)
    for (const slug of slugs) {
      expect(listed, `blog post ${slug} missing from sitemap.xml`).toContain(`/blog/${slug}`)
    }
  })

  it('uses one consistent URL form, so canonicals and sitemap agree', () => {
    for (const loc of listed) {
      if (loc === '/') continue
      expect(loc.endsWith('/'), `${loc} has a trailing slash; canonicals emit none`).toBe(false)
      expect(loc.startsWith('/'), `${loc} should be root-relative`).toBe(true)
    }
  })
})
