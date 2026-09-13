import { test, expect } from '@playwright/test'

test('organization contact withdrawal persists across a reload at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Community Foundation', role: 'organization', needsWebsite: true, legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/auth/refresh', route => route.fulfill({ json: { data: { accessToken: 'test', refreshToken: 'test' } } }))
  await page.route('**/api/v1/creators/ama', route => route.fulfill({ json: { data: { userId: 'bbbbbbbbbbbbbbbbbbbbbbbb', handle: 'ama', displayName: 'Ama', bio: 'Community stories', tagline: 'Stories', tipsEnabled: false, presetAmounts: [], currency: 'GHS', supporterCount: 0, totalReceived: 0, recentTips: [] } } }))
  let requested = true
  await page.route('**/api/v1/profile/website-request', route => route.fulfill({ json: { data: { needsWebsite: requested } } }))
  await page.route('**/api/v1/profile/website-request/withdraw', route => {
    expect(route.request().method()).toBe('POST')
    requested = false
    return route.fulfill({ json: { data: { needsWebsite: false } } })
  })
  await page.goto('/creators/ama')
  const notice = page.getByRole('alert').filter({ hasText: 'Your website request is saved' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: 'neurodyne.dev', exact: true })).toHaveAttribute('href', 'https://neurodyne.dev')
  const bounds = await notice.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  await notice.screenshot({ path: '/tmp/ujimora-website-request-phone.png' })
  await notice.getByRole('button', { name: 'Withdraw website request' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'has been withdrawn' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Your website request is saved')).not.toBeVisible()
  expect(requested).toBe(false)
})
