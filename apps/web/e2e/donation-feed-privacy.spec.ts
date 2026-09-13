import { test, expect } from '@playwright/test'

test('redacts donor identity on refresh while preserving the financial row', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const campaignId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route(`**/api/v1/campaigns/${campaignId}`, route => route.fulfill({ json: { data: { id: campaignId, title: 'Public contribution fixture', description: 'A community project.', creatorId: 'cccccccccccccccccccccccc', status: 'active', currency: 'GHS', raisedAmount: 125, goalAmount: 500, category: 'education', priority: 'normal', imageUrls: [], beneficiaries: [], startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z' } } }))
  let restricted = false
  let reads = 0
  await page.route(`**/api/v1/campaigns/${campaignId}/donations?*`, route => {
    reads++
    return route.fulfill({ json: { data: { items: [{ id: 'donation', donorName: restricted ? 'Anonymous' : 'Public donor fixture', isAnonymous: restricted, message: restricted ? undefined : 'A donor message to remove', amount: 125, currency: 'GHS', createdAt: '2026-09-12T00:00:00Z' }], total: 1, page: 1, pageSize: 10, totalPages: 1 } } })
  })
  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Donations', exact: true }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByText('Public donor fixture', { exact: true })).toBeVisible()
  await expect(panel.getByText('A donor message to remove')).toBeVisible()
  const before = reads
  restricted = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => reads).toBeGreaterThan(before)
  await expect(panel.getByText('Anonymous', { exact: true })).toBeVisible()
  await expect(panel.getByText('Public donor fixture')).toHaveCount(0)
  await expect(panel.getByText('A donor message to remove')).toHaveCount(0)
  await expect(panel.getByRole('heading', { name: 'Donations (1)' })).toBeVisible()
  await expect(panel.getByText(/125/)).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-donation-feed-privacy-phone.png', animations: 'disabled' })
})
