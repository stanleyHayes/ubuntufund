import { test, expect } from '@playwright/test'

test('newsletter request, confirmation and signed-out withdrawal on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    if (sessionStorage.getItem('newsletterTestInitialized')) return
    sessionStorage.setItem('newsletterTestInitialized', 'yes')
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Newsletter test', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/profile', route => route.fulfill({ json: { data: { notificationPreferences: {}, language: 'English' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route('**/api/v1/profile/activity-alerts', route => route.fulfill({ json: { data: { preferences: Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }])), emailVerified: false, emailConfigured: true } } }))
  let status = 'off', confirmations = 0, withdrawals = 0
  await page.route('**/api/v1/newsletter/preference', route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON()).toEqual({ enabled: true })
      status = 'pending'
    }
    return route.fulfill({ json: { data: { status } } })
  })
  const token = 'c'.repeat(64)
  await page.route('**/api/v1/newsletter/confirm', route => {
    expect(route.request().postDataJSON()).toEqual({ token }); status = 'active'; confirmations++
    return route.fulfill({ json: { data: { subscribed: true } } })
  })
  await page.route('**/api/v1/newsletter/unsubscribe', route => {
    expect(route.request().postDataJSON()).toEqual({ token }); status = 'off'; withdrawals++
    return route.fulfill({ json: { data: { subscribed: false } } })
  })
  await page.route('**/api/v1/publication-reviews**', route => route.fulfill({ json: { data: { items: [], total: 0 } } }))
  await page.goto('/settings')
  const toggle = page.getByRole('switch', { name: 'Marketing emails and newsletter', exact: true })
  await expect(toggle).not.toBeChecked()
  await toggle.click()
  await expect(page.getByText('Requested — awaiting email confirmation')).toBeVisible()
  await page.goto(`/newsletter/confirm#token=${token}`)
  await expect(page.getByRole('button', { name: 'Confirm subscription', exact: true })).toBeVisible()
  expect(confirmations).toBe(0)
  await expect(page).not.toHaveURL(/token=/)
  await page.getByRole('button', { name: 'Confirm subscription', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('subscription is confirmed')
  await page.getByRole('link', { name: 'Go to Settings' }).click()
  await expect(page.getByText('Subscribed', { exact: true })).toBeVisible()
  await page.evaluate(() => { localStorage.removeItem('uf_tokens'); localStorage.removeItem('uf_user') })
  await page.goto(`/newsletter/unsubscribe#token=${token}`)
  await page.getByRole('button', { name: 'Unsubscribe', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('You are unsubscribed')
  expect(withdrawals).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('uf_tokens'))).toBeNull()
  await page.screenshot({ path: '/tmp/ujimora-newsletter-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
