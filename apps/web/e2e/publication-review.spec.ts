import { test, expect } from '@playwright/test'

test('keeps a held comment private and lets its author resubmit after review at phone width', async ({ page }) => {
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
  await page.route(`**/api/v1/campaigns/${campaignId}/updates`, route => route.fulfill({ json: { data: { items: [{ id: updateId, campaignId, authorId, title: 'Classroom progress', content: 'An update readers can report for review.', type: 'general', isPinned: false, mediaUrls: [], createdAt: '2026-09-12T00:00:00Z', updatedAt: '2026-09-12T00:00:00Z' }] } } }))
  let approved = false
  const submissions: unknown[] = []
  const draft = 'A proposed comment awaiting safety review.'
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route(`**/api/v1/campaigns/${campaignId}/comments`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: { items: [] } } })
    submissions.push(route.request().postDataJSON())
    return approved
      ? route.fulfill({ status: 201, json: { data: { id: 'comment', campaignId, authorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', authorName: 'Reader', content: draft, createdAt: '2026-09-12T00:00:00Z' } } })
      : route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published. Keep your draft and check Publication reviews before submitting this same version again.' } })
  })
  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Comments', exact: true }).click()
  const consent = page.getByRole('checkbox', { name: /Use OpenAI/ })
  await expect(consent).not.toBeChecked()
  const composer = page.getByPlaceholder(/Share encouragement/)
  await composer.fill(draft)
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  await expect(composer).toHaveValue(draft)
  expect(submissions).toEqual([{ content: draft, automatedReviewConsent: false }])
  await consent.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-publication-review-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  approved = true
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(composer).toHaveValue('')
  await expect(page.getByText(draft, { exact: true })).toBeVisible()
  expect(submissions).toHaveLength(2)
  expect(pageErrors).toEqual([])
})
