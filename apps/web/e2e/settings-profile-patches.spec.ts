import { test, expect } from '@playwright/test'

test('saves only changed privacy fields in order and restores a rejected choice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Settings fixture', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route('**/api/v1/profile/activity-alerts', route => route.fulfill({ json: { data: { preferences: Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }])), emailVerified: false, emailConfigured: false } } }))
  await page.route('**/api/v1/newsletter/preference', route => route.fulfill({ json: { data: { status: 'off' } } }))
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { items: [], total: 0 } } }))
  const changes: unknown[] = []
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let releaseFailures!: () => void
  const failedSaves = new Promise<void>(resolve => { releaseFailures = resolve })
  await page.route('**/api/v1/profile', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: { language: 'English', publicProfile: true, showLeaderboards: true, anonymousDonations: false } } })
    const body = route.request().postDataJSON()
    changes.push(body)
    if (changes.length === 1) await gate
    if (changes.length === 4) await failedSaves
    if (body.publicProfile === true || changes.length >= 4) return route.fulfill({ status: 503, json: { message: 'Settings could not be saved. Please retry.' } })
    return route.fulfill({ json: { data: body } })
  })
  await page.goto('/settings')
  const visibility = page.getByRole('switch', { name: 'Allow profile to be public', exact: true })
  const leaderboard = page.getByRole('switch', { name: 'Show me on leaderboards', exact: true })
  await visibility.uncheck()
  await expect.poll(() => changes.length).toBe(1)
  await leaderboard.uncheck()
  expect(changes).toEqual([{ publicProfile: false }])
  release()
  await expect.poll(() => changes.length).toBe(2)
  expect(changes).toEqual([{ publicProfile: false }, { showLeaderboards: false }])
  await expect(page.getByText('Settings saved', { exact: true })).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-alert-close-success-phone.png', animations: 'disabled' })
  // The rejected save may roll back before Playwright checks the input state.
  await visibility.click()
  await expect(page.getByText('Settings could not be saved. Please retry.', { exact: true })).toBeVisible()
  await expect(visibility).not.toBeChecked()
  await expect(leaderboard).not.toBeChecked()
  expect(changes[2]).toEqual({ publicProfile: true, automatedReviewConsent: false })
  // Two rejected opposite choices must restore the server-confirmed value, not an optimistic predecessor.
  await visibility.check()
  await expect.poll(() => changes.length).toBe(4)
  await visibility.uncheck()
  releaseFailures()
  await expect.poll(() => changes.length).toBe(5)
  await expect(visibility).not.toBeChecked()
  await page.screenshot({ path: '/tmp/ujimora-profile-patch-settings-phone.png', animations: 'disabled' })
  expect(errors).toEqual([])
})
