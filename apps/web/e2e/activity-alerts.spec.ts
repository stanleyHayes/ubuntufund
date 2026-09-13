import { test, expect } from '@playwright/test'

test('activity choices stay opt-in, persist on reload and fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Notification test', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/profile', route => route.fulfill({ json: { data: { notificationPreferences: {}, language: 'English' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [], total: 0 } } }))
  const preferences: Record<string, { inApp: boolean; email: boolean }> = Object.fromEntries(
    ['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }]),
  )
  await page.route('**/api/v1/profile/activity-alerts', route => {
    if (route.request().method() === 'PUT') {
      const { category, channel, enabled } = route.request().postDataJSON() as { category: keyof typeof preferences; channel: 'email' | 'inApp'; enabled: boolean }
      preferences[category][channel] = enabled
      return route.fulfill({ json: { data: { category, channel, enabled } } })
    }
    return route.fulfill({ json: { data: { preferences, emailVerified: true, emailConfigured: true } } })
  })
  await page.goto('/settings')
  const withdrawal = page.getByRole('checkbox', { name: 'Withdrawals and payouts emails', exact: true })
  await expect(withdrawal).not.toBeChecked()
  await withdrawal.click()
  await expect(page.getByRole('status').filter({ hasText: 'Withdrawals and payouts emails enabled' })).toBeVisible()
  await page.reload()
  await expect(withdrawal).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Donations received emails', exact: true })).not.toBeChecked()
  await withdrawal.click()
  await expect(page.getByRole('status').filter({ hasText: 'turned off' })).toBeVisible()
  await withdrawal.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-activity-alerts-phone.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.reload()
  await expect(withdrawal).not.toBeChecked()
})
