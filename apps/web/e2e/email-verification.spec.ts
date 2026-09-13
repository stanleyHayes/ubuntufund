import { test, expect } from '@playwright/test'

test('verification enables eligibility while activity emails remain opt-in on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Verification test', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/profile', route => route.fulfill({ json: { data: { notificationPreferences: {}, language: 'English' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  const preferences: Record<string, { inApp: boolean; email: boolean }> = Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }]))
  let verified = false, requests = 0, confirmations = 0, choices = 0
  await page.route('**/api/v1/profile/activity-alerts', route => {
    if (route.request().method() === 'PUT') {
      const { category, channel, enabled } = route.request().postDataJSON() as { category: string; channel: 'inApp' | 'email'; enabled: boolean }
      preferences[category][channel] = enabled; choices++
      return route.fulfill({ json: { data: { category, channel, enabled } } })
    }
    return route.fulfill({ json: { data: { preferences, emailVerified: verified, emailConfigured: true } } })
  })
  await page.route('**/api/v1/email-verification', route => { requests++; return route.fulfill({ json: { data: { emailVerified: false } } }) })
  const token = 'b'.repeat(64)
  await page.route('**/api/v1/email-verification/confirm', route => {
    expect(route.request().postDataJSON()).toEqual({ token }); verified = true; confirmations++
    return route.fulfill({ json: { data: { emailVerified: true } } })
  })
  await page.goto('/settings')
  const email = page.getByRole('checkbox', { name: 'Withdrawals and payouts emails', exact: true })
  await expect(email).toBeDisabled()
  await page.getByRole('button', { name: 'Send verification link' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Check your email' })).toBeVisible()
  expect(requests).toBe(1)
  await page.goto(`/verify-email#token=${token}`)
  await expect(page.getByRole('heading', { name: 'Verify your email address' })).toBeVisible()
  expect(confirmations).toBe(0)
  await page.getByRole('button', { name: 'Verify email address', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('choices have not changed')
  expect(choices).toBe(0)
  await page.screenshot({ path: '/tmp/ujimora-email-verification-phone.png', animations: 'disabled' })
  await page.getByRole('link', { name: 'Go to Settings' }).click()
  await expect(email).toBeEnabled()
  await expect(email).not.toBeChecked()
  await email.click()
  await expect(page.getByRole('status').filter({ hasText: 'emails enabled' })).toBeVisible()
  expect(choices).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
