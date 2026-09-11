import { beforeAll, afterAll, expect, it } from 'vitest'
import request from 'supertest'
import type { Express } from 'express'
import { createTestApp } from '../helpers/testApp.js'
import {
  connectTestDatabase,
  dropTestDatabase,
  disconnectTestDatabase,
} from '../helpers/testDatabase.js'
import { CampaignModel } from '../../src/infrastructure/database/models/CampaignModel.js'

let app: Express

beforeAll(async () => {
  await connectTestDatabase()
  app = await createTestApp()
})

afterAll(async () => {
  await dropTestDatabase()
  await disconnectTestDatabase()
})

/**
 * The sitemap is how campaigns get discovered at all — app.ujimora.com shipped
 * without one. What matters is not that it responds, but that it lists exactly
 * the campaigns a visitor can open, under the URL shape the pages themselves
 * declare as canonical.
 */
it('lists indexable campaigns under their canonical slug URL, and nothing else', async () => {
  const base = {
    creatorId: 'creator-1',
    title: 'Help Ama finish school',
    description: 'A campaign',
    goalAmount: 5000,
    raisedAmount: 0,
    currency: 'GHS',
    category: 'education',
    priority: 'normal',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86_400_000),
  }

  await CampaignModel.create([
    { ...base, slug: 'live-campaign', status: 'active' },
    { ...base, slug: 'funded-campaign', status: 'funded' },
    // Each of these renders behind a guard, so listing it would send crawlers
    // to a page that answers with nothing.
    { ...base, slug: 'draft-campaign', status: 'draft' },
    { ...base, slug: 'blocked-campaign', status: 'blocked' },
    { ...base, slug: 'pending-campaign', status: 'pending_review' },
    { ...base, slug: 'deleted-campaign', status: 'active', deletedAt: new Date() },
    // No slug: the canonical is the slug form, so listing an id URL here would
    // point crawlers at a URL that canonicalises somewhere else.
    { ...base, status: 'active' },
  ])

  const res = await request(app).get('/sitemap.xml').expect(200)
  expect(res.headers['content-type']).toMatch(/xml/)

  expect(res.text).toContain('<loc>https://app.ujimora.com/c/live-campaign</loc>')
  expect(res.text).toContain('<loc>https://app.ujimora.com/c/funded-campaign</loc>')
  for (const excluded of ['draft-campaign', 'blocked-campaign', 'pending-campaign', 'deleted-campaign']) {
    expect(res.text, `${excluded} must not be listed`).not.toContain(excluded)
  }

  // Static public routes, and no authenticated ones.
  expect(res.text).toContain('<loc>https://app.ujimora.com/explore</loc>')
  for (const priv of ['/dashboard', '/settings', '/wallet', '/payout-accounts']) {
    expect(res.text, `${priv} is private and must not be listed`).not.toContain(`${priv}<`)
  }

  // Well-formed enough for a crawler: one urlset, balanced url elements.
  expect(res.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  expect((res.text.match(/<url>/g) ?? []).length).toBe((res.text.match(/<\/url>/g) ?? []).length)
  expect(res.text).toContain('</urlset>')
})

/**
 * The API host answered its JSON 404 for /robots.txt, so crawlers assumed the
 * whole host was fair game.
 *
 * The subtle part is what this must NOT do. The browser calls /api/v1 on the
 * app's own origin and Vercel rewrites it here — but point VITE_API_URL at the
 * absolute origin and a blanket `Disallow: /` would stop Googlebot fetching
 * the data the SPA renders from, blanking every campaign page. Fetching stays
 * open; the X-Robots-Tag header is what keeps the JSON out of the index.
 */
it('allows crawling the API host but marks every response noindex', async () => {
  const robots = await request(app).get('/robots.txt').expect(200)
  expect(robots.headers['content-type']).toMatch(/text\/plain/)
  expect(robots.text).toContain('Allow: /')
  expect(robots.text, 'a blanket Disallow would blank every rendered campaign page')
    .not.toMatch(/^Disallow: \/$/m)
  // Reference-bearing endpoints no crawler should ever walk.
  expect(robots.text).toContain('Disallow: /api/v1/webhooks/')

  const api = await request(app).get('/api/v1/campaigns')
  expect(api.headers['x-robots-tag']).toBe('noindex, nofollow')

  // The sitemap is for crawlers; telling them not to follow it defeats it.
  const sitemap = await request(app).get('/sitemap.xml').expect(200)
  expect(sitemap.headers['x-robots-tag']).toBeUndefined()
  expect(robots.headers['x-robots-tag']).toBeUndefined()
})
