import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Vercel project's Root Directory is apps/web, so apps/web/vercel.json is
 * the config in effect (the repo-root vercel.json is ignored). robots.txt
 * advertises app.ujimora.com/sitemap.xml, but without its own rewrite that URL
 * fell into the SPA catch-all and crawlers received index.html.
 */
// Vitest runs with apps/web as the cwd.
const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] }
const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8')

describe('web vercel.json', () => {
  it('proxies the sitemap robots.txt advertises to the API before the SPA catch-all', () => {
    expect(robots).toContain('Sitemap: https://app.ujimora.com/sitemap.xml')
    const sources = config.rewrites.map(rule => rule.source)
    const sitemap = sources.indexOf('/sitemap.xml')
    expect(sitemap).toBeGreaterThanOrEqual(0)
    expect(config.rewrites[sitemap].destination).toBe('https://api.ujimora.com/sitemap.xml')
    const catchAll = sources.findIndex(source => source.startsWith('/:path('))
    expect(catchAll).toBeGreaterThan(sitemap)
  })
})
