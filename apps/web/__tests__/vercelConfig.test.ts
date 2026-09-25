// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { vercelApiUrlOverride } from '../vite.config'

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

// R2-056: Vercel builds Preview deployments in production mode, so they loaded
// .env.production and called api.ujimora.com from *.vercel.app, which CORS
// refuses. Only a Production build may use the absolute API URL.
describe('API base per Vercel environment', () => {
  const production = readFileSync(resolve(process.cwd(), '.env.production'), 'utf8')

  it('keeps the direct API URL for production and for local or CI builds', () => {
    expect(production).toMatch(/^VITE_API_URL=https:\/\/api\.ujimora\.com\/api\/v1$/m)
    expect(vercelApiUrlOverride({ VERCEL_ENV: 'production' })).toBeUndefined()
    expect(vercelApiUrlOverride({})).toBeUndefined()
  })

  it('sends preview and development builds through the same-origin /api/v1 rewrite', () => {
    expect(vercelApiUrlOverride({ VERCEL_ENV: 'preview' })).toBe('/api/v1')
    expect(vercelApiUrlOverride({ VERCEL_ENV: 'development' })).toBe('/api/v1')
    const rewrite = config.rewrites.find((rule) => rule.source === '/api/v1/:path*')
    expect(rewrite?.destination).toBe('https://api.ujimora.com/api/v1/:path*')
  })

  it("respects an environment's own VITE_API_URL set in the Vercel project", () => {
    expect(vercelApiUrlOverride({ VERCEL_ENV: 'preview', VITE_API_URL: 'https://staging-api.example.test/api/v1' })).toBeUndefined()
  })

  it('makes VERCEL_ENV part of the Turborepo build hash, so a preview never reuses a production build', () => {
    const turbo = JSON.parse(readFileSync(resolve(process.cwd(), 'turbo.json'), 'utf8')) as { extends: string[]; tasks: { build: { env: string[] } } }
    expect(turbo.extends).toEqual(['//'])
    expect(turbo.tasks.build.env).toContain('VERCEL_ENV')
  })
})
