import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('private data request and downloadable response on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dataRightsTestInitialized')) return
    sessionStorage.setItem('dataRightsTestInitialized', 'yes')
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Newsletter test', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/profile', route => route.fulfill({ json: { data: { notificationPreferences: {}, language: 'English' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route('**/api/v1/profile/activity-alerts', route => route.fulfill({ json: { data: { preferences: Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }])), emailVerified: false, emailConfigured: true } } }))
  await page.route('**/api/v1/newsletter/preference', route => route.fulfill({ json: { data: { status: 'off' } } }))
  let items: Record<string, unknown>[] = []
  await page.route('**/api/v1/data-rights**', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ kind: 'access', details: 'Please provide my account and transaction information.' })
      items = [{ _id: 'aaaaaaaaaaaaaaaaaaaaaaab', kind: 'access', details: 'Please provide my account and transaction information.', status: 'open', response: '', dueAt: '2026-10-12T00:00:00Z' }]
      return route.fulfill({ status: 201, json: { data: items[0] } })
    }
    return route.fulfill({ json: { data: { items, total: items.length } } })
  })
  await page.route('**/api/v1/publication-reviews**', route => route.fulfill({ json: { data: { items: [], total: 0 } } }))
  await page.goto('/settings')
  await page.getByLabel('What would you like us to review?').fill('Please provide my account and transaction information.')
  await page.getByRole('button', { name: 'Submit privacy request', exact: true }).click()
  await expect(page.getByText('Access to my data · open')).toBeVisible()
  items[0] = { ...items[0], status: 'responded', response: 'Here is the information requested. This test response belongs only to this account.' }
  await page.getByRole('button', { name: 'Refresh privacy requests', exact: true }).click()
  await expect(page.getByText('Access to my data · responded')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download request and response', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('ujimora-privacy-request-aaaaaaaaaaaaaaaaaaaaaaab.json')
  const path = await download.path()
  const data = JSON.parse(await readFile(path!, 'utf8'))
  expect(data.response).toBe(items[0].response)
  expect(data).not.toHaveProperty('evidence')
  await page.getByText('Access to my data · responded').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-data-rights-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
