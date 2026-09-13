import { test, expect } from '@playwright/test'
test('report an anonymous supporter message at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Viewer', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/creators/ama', route => route.fulfill({ json: { data: { userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', handle: 'ama', displayName: 'Ama', tipsEnabled: false, presetAmounts: [10, 25], currency: 'GHS', supporterCount: 1, totalReceived: 75, recentTips: [{ id: 'cccccccccccccccccccccccc', supporterName: 'Anonymous', amount: 75, message: 'Public supporter message to review' }] } } }))
  let report: unknown
  await page.route('**/api/v1/safety/reports', route => { report = route.request().postDataJSON(); return route.fulfill({ json: { data: { id: 'report', status: 'pending' } } }) })
  await page.goto('/creators/ama')
  await expect(page.getByText('Public supporter message to review', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Report', exact: true }).last().click()
  await page.getByRole('textbox', { name: 'What happened?' }).fill('Please review the harassment in this supporter message.')
  await page.getByRole('button', { name: 'Send report' }).click()
  await expect(page.getByRole('status')).toContainText('Report received')
  expect(report).toMatchObject({ targetType: 'tip_message', targetId: 'cccccccccccccccccccccccc' })
  expect(report).not.toHaveProperty('targetUserId')
  await page.getByRole('status').scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-supporter-report-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
