import { test, expect } from '@playwright/test'

test('retains a held creator draft, pauses separately, and resubmits after staff approval at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Ama', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route('**/api/v1/payout-accounts', route => route.fulfill({ json: { data: { accounts: [], limit: 2, planName: 'Plus' } } }))
  let profile = { handle: 'ama', displayName: 'Ama', tagline: 'Music and stories', bio: 'Original biography', tipsEnabled: true, presetAmounts: [15, 30], currency: 'GHS', avatarUrl: '', coverUrl: '' }
  let approved = false
  const submissions: Record<string, unknown>[] = []
  await page.route('**/api/v1/creators/me', route => route.fulfill({ json: { data: { profile, balance: { availableBalance: 100, totalReceived: 100, paidOutBalance: 0, currency: 'GHS' }, policy: { eligible: true, planName: 'Plus', feePercent: 3 } } } }))
  await page.route('**/api/v1/creators/profile', route => {
    const body = route.request().postDataJSON()
    submissions.push(body)
    if (Object.keys(body).length === 1 && body.tipsEnabled === false) {
      profile = { ...profile, tipsEnabled: false }
      return route.fulfill({ json: { data: profile } })
    }
    if (approved) {
      profile = { ...profile, ...body }
      return route.fulfill({ json: { data: profile } })
    }
    return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published.' } })
  })
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { total: 1, items: [{ id: 'review-creator', action: 'creator.profile', status: approved ? 'approved' : 'pending', text: JSON.stringify({ displayName: 'Ama', bio: 'Proposed new biography' }), ...(approved ? { reviewNotes: 'Complete creator version reviewed.' } : {}) }] } } }))
  await page.goto('/creator')
  const bio = page.getByLabel('About you')
  await expect(bio).toHaveValue('Original biography')
  await bio.fill('Proposed new biography')
  const consent = page.getByRole('checkbox', { name: /Use OpenAI/ })
  await expect(consent).not.toBeChecked()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  await expect(bio).toHaveValue('Proposed new biography')
  expect(submissions[0]).toMatchObject({ bio: 'Proposed new biography', automatedReviewConsent: false })
  expect(profile.bio).toBe('Original biography')
  await page.getByRole('button', { name: 'Pause tips now', exact: true }).click()
  await expect(page.getByText('Tips paused. Your other draft changes are retained.')).toBeVisible()
  expect(submissions[1]).toEqual({ tipsEnabled: false })
  await expect(bio).toHaveValue('Proposed new biography')
  await expect(page.getByRole('switch', { name: 'Accept tips' })).not.toBeChecked()
  // The paused version changed the base revision, so submit the retained draft for a fresh check.
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  approved = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByText('Review response: Complete creator version reviewed.')).toBeVisible()
  await page.screenshot({ path: '/tmp/ujimora-creator-review-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Your creator page is saved')).toBeVisible()
  await expect(bio).toHaveValue('Proposed new biography')
  expect(submissions[3]).toEqual(submissions[2])
  expect(pageErrors).toEqual([])
})
