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
    // A reworded message, so only the `errors` marker identifies the hold: this
    // covers api.ts passing `errors` through (the other specs use the message).
    return approved
      ? route.fulfill({ status: 201, json: { data: { id: 'comment', campaignId, authorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', authorName: 'Reader', content: draft, createdAt: '2026-09-12T00:00:00Z' } } })
      : route.fulfill({ status: 409, json: { message: 'Your comment is waiting for a safety review.', errors: { publication: ['held'] } } })
  })
  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Comments', exact: true }).click()
  const consent = page.getByRole('checkbox', { name: /Use OpenAI/ })
  await expect(consent).not.toBeChecked()
  const composer = page.getByPlaceholder(/Share encouragement/)
  await composer.fill(draft)
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  await expect(page.getByText(/Saved privately for safety review/)).toBeVisible()
  // Being held for review is expected, not a failure: an info status notice, never a red alert.
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for safety review' })).toHaveClass(/MuiAlert-colorInfo/)
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

test('publishes a held comment once approved, without posting it again, at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('uf_user', JSON.stringify({ id: 'aaaaaaaaaaaaaaaaaaaaaaaa', name: 'Reader', role: 'user', legalAcceptance: { version: '2026-09-12', acceptedTerms: true, ageConfirmed: true, acceptedAt: '2026-09-12T00:00:00Z' } }))
    localStorage.setItem('uf_tokens', JSON.stringify({ accessToken: 'test', refreshToken: 'test' }))
  })
  const campaignId = 'bbbbbbbbbbbbbbbbbbbbbbbb', authorId = 'cccccccccccccccccccccccc'
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: route.request().url().endsWith('/auth/refresh') ? { accessToken: 'test', refreshToken: 'test' } : [] } }))
  await page.route('**/api/v1/notifications/unread-count', route => route.fulfill({ json: { data: { count: 0 } } }))
  await page.route(`**/api/v1/campaigns/${campaignId}`, route => route.fulfill({ json: { data: { id: campaignId, title: 'Community classroom', description: 'A local classroom project.', creatorId: authorId, status: 'active', currency: 'GHS', raisedAmount: 125, goalAmount: 500, category: 'education', priority: 'normal', imageUrls: [], beneficiaries: [], startDate: '2026-09-01T00:00:00Z', endDate: '2026-12-01T00:00:00Z' } } }))
  await page.route(`**/api/v1/users/${authorId}/public`, route => route.fulfill({ json: { data: { id: authorId, name: 'Organizer', role: 'user', verificationLevel: 2, trustScore: 50, country: 'Ghana', createdAt: '2025-01-01T00:00:00Z' } } }))
  await page.route(`**/api/v1/campaigns/${campaignId}/updates`, route => route.fulfill({ json: { data: { items: [] } } }))
  await page.route('**/api/v1/safety/blocks', route => route.fulfill({ json: { data: { items: [] } } }))
  // Settings, where Publication reviews lists every kind of change.
  await page.route('**/api/v1/profile', route => route.fulfill({ json: { data: { name: 'Reader', darkMode: false, anonymousDonations: false, showLeaderboards: true, publicProfile: false } } }))
  await page.route('**/api/v1/profile/activity-alerts', route => route.fulfill({ json: { data: { preferences: Object.fromEntries(['donationsReceived', 'donationsSent', 'creatorTips', 'withdrawals', 'refunds', 'wallet', 'subscriptions'].map(category => [category, { inApp: false, email: false }])), emailVerified: false, emailConfigured: false } } }))
  await page.route('**/api/v1/newsletter/preference', route => route.fulfill({ json: { data: { status: 'off' } } }))
  const draft = 'A proposed comment its approval publishes.'
  const posted = { id: 'comment', campaignId, authorId: 'aaaaaaaaaaaaaaaaaaaaaaaa', authorName: 'Reader', content: draft, createdAt: '2026-10-01T10:05:00Z' }
  let published = false
  const submissions: unknown[] = []
  await page.route(`**/api/v1/campaigns/${campaignId}/comments`, route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: { items: published ? [posted] : [] } } })
    submissions.push(route.request().postDataJSON())
    return route.fulfill({ status: 409, json: { message: 'Saved privately for safety review. Your content has not been published yet. It will be published automatically once a reviewer approves it; check Publication reviews for the decision.', errors: { publication: ['held', 'publishes_on_approval'] } } })
  })
  await page.route('**/api/v1/publication-reviews?*', route => route.fulfill({ json: { data: { total: 1, items: [{
    id: 'comment-review', action: 'comment.create', resourceId: campaignId, text: JSON.stringify({ authorName: 'Reader', comment: draft }), mediaUrls: [], createdAt: '2026-10-01T10:00:00Z',
    publishOnApproval: true,
    ...(published
      ? { status: 'approved', reviewNotes: 'A kind, respectful comment.', approvalExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), publication: { state: 'published', at: '2026-10-01T10:05:00Z' }, canWithdraw: false }
      : { status: 'pending', canWithdraw: true }),
  }] } } }))

  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Comments', exact: true }).click()
  const composer = page.getByPlaceholder(/Share encouragement/)
  await composer.fill(draft)
  await page.getByRole('checkbox', { name: /Use OpenAI/ }).check()
  await page.getByRole('button', { name: 'Post comment', exact: true }).click()
  const notice = page.getByRole('status').filter({ hasText: 'Waiting for safety review' })
  await expect(notice).toContainText("Once a reviewer approves it, it's published automatically, so you don't need to submit it again.")
  await expect(notice).toHaveClass(/MuiAlert-colorInfo/)
  // Nothing to post again: the composer starts afresh.
  await expect(composer).toHaveValue('')
  await expect(page.getByRole('checkbox', { name: /Use OpenAI/ })).not.toBeChecked()
  expect(submissions).toEqual([{ content: draft, automatedReviewConsent: true }])

  await page.goto('/settings#privacy')
  const waiting = page.getByRole('list', { name: 'Review status: In review' })
  await expect(waiting.getByRole('listitem')).toHaveText([/^Submitted/, 'In review', 'Approved, not yet', 'Published, not yet'])
  await expect(page.getByText("A person is checking it. It's published automatically once approved.")).toBeVisible()
  await expect(page.getByRole('button', { name: `Withdraw Comment · ${draft}` })).toBeVisible()
  published = true
  await page.getByRole('button', { name: 'Refresh publication reviews' }).click()
  await expect(page.getByRole('list', { name: 'Review status: Published' })).toBeVisible()
  await expect(page.getByText('Approved and posted on the campaign.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Withdraw/ })).toHaveCount(0)
  await page.getByRole('list', { name: 'Review status: Published' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/ujimora-publication-published-phone.png', animations: 'disabled' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.goto(`/campaigns/${campaignId}`)
  await page.getByRole('tab', { name: 'Comments', exact: true }).click()
  await expect(page.getByText(draft, { exact: true })).toBeVisible()
  expect(submissions).toHaveLength(1)
  expect(pageErrors).toEqual([])
})
