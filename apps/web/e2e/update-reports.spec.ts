import { test, expect } from '@playwright/test'

test('reports a campaign update by item ID at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Reader', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const campaignId = 'bbbbbbbbbbbbbbbbbbbbbbbb', authorId = 'cccccccccccccccccccccccc', updateId = 'dddddddddddddddddddddddd'
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route(`**/api/v1/campaigns/${campaignId}`, route => route.fulfill({ json: { data: { id: campaignId, title: 'Community classroom', description: 'A local classroom project.', creatorId: authorId, status: 'active', currency: 'GHS', raisedAmount: 125, goalAmount: 500, category: 'education', priority: 'normal', imageUrls: [], beneficiaries: [], startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z' } } }))
  await page.route(`**/api/v1/users/${authorId}/public`, route => route.fulfill({ json: { data: { id: authorId, name: 'Organizer', role: 'user', verificationLevel: 2, trustScore: 50, country: 'Ghana', createdAt: '2025-01-01T00:00:00Z' } } }))
  let authorRestricted = false
  await page.route(`**/api/v1/campaigns/${campaignId}/updates`, route => route.fulfill({ json: { data: { items: authorRestricted ? [] : [{ id: updateId, campaignId, authorId, title: 'Classroom progress', content: 'An update readers can report for review.', type: 'general', isPinned: false, mediaUrls: [], createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z' }] } } }))
  let report: unknown
  await page.route('**/api/v1/safety/reports', route => { report = route.request().postDataJSON(); return route.fulfill({ json: { data: { id: 'report', status: 'pending' } } }) })
  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Updates', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Classroom progress' })).toBeVisible()
  await page.getByRole('tabpanel').getByRole('button', { name: 'Report', exact: true }).click()
  await page.getByRole('textbox', { name: 'What happened?' }).fill('Please review the content of this campaign update.')
  await page.screenshot({ path: '/tmp/ujimora-update-report-phone.png', animations: 'disabled' })
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(page.getByRole('status')).toContainText('Report received')
  expect(report).toMatchObject({ targetType: 'campaign_update', targetId: updateId })
  expect(report).not.toHaveProperty('targetUserId')
  authorRestricted = true
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('The story is just getting started', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Classroom progress' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Community classroom', exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-restricted-update-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(pageErrors).toEqual([])
})
