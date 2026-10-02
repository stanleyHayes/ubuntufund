import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type VercelConfig = { headers?: { source: string; headers: { key: string; value: string }[] }[] }
// Vitest runs with the web workspace as its root; the other apps are siblings.
const load = (app: string): VercelConfig => JSON.parse(readFileSync(resolve(__dirname, '../../..', app, 'vercel.json'), 'utf8'))

describe('frontend security headers', () => {
  it.each([
    ['web', 'SAMEORIGIN', "frame-ancestors 'self'"],
    ['admin', 'DENY', "frame-ancestors 'none'"],
    ['marketing', 'SAMEORIGIN', "frame-ancestors 'self'"],
  ])('%s pages cannot be framed by other sites and are not MIME-sniffed', (app, frame, ancestors) => {
    // One rule carries the security headers; robots rules (below) are separate.
    const rules = (load(app).headers ?? []).filter((candidate) => candidate.headers.some(({ key }) => key === 'X-Frame-Options'))
    expect(rules).toHaveLength(1)
    const [rule] = rules
    const values = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]))
    expect(values).toEqual({
      'X-Frame-Options': frame,
      'Content-Security-Policy': ancestors,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    })
    // The API sets its own headers (helmet); the web broadcast preview frames the
    // proxied /api/v1 overlay, so proxied API paths are excluded.
    const matches = new RegExp(`^${rule.source}$`)
    expect(matches.test('/settings')).toBe(true)
    expect(matches.test('/')).toBe(true)
    expect(matches.test('/api/v1/live-sessions/x/overlay/view')).toBe(false)
  })

  it('keeps the admin console out of search results on every path', () => {
    const robots = (load('admin').headers ?? []).find((rule) => rule.headers.some(({ key }) => key === 'X-Robots-Tag'))
    expect(robots?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }])
    const matches = new RegExp(`^${robots!.source}$`)
    for (const path of ['/', '/login', '/campaigns/abc', '/robots.txt']) expect(matches.test(path), path).toBe(true)
  })

  it('marks the marketing fallback pages noindex when requested directly', () => {
    const robots = (load('marketing').headers ?? []).find((rule) => rule.headers.some(({ key }) => key === 'X-Robots-Tag'))
    expect(robots?.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex' }])
    const matches = new RegExp(`^${robots!.source}$`)
    expect(matches.test('/app-shell.html')).toBe(true)
    expect(matches.test('/404.html')).toBe(true)
    expect(matches.test('/pricing')).toBe(false)
  })
})
